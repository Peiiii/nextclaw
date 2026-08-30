import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import {
  AppHomeService,
  AppInstallationService,
  AppManifestService,
  AppRegistryService,
  type AppSecretBinding,
  isAppComponentManifestBundle,
} from "@nextclaw/app-runtime";
import type {
  AppInstallProgressHandler,
  AppRollbackResult,
  AppUninstallResult,
  AppUpdateResult,
} from "@nextclaw/app-runtime";
import { AppPackageOperationManager } from "@kernel/managers/app-package-operation.manager.js";
import { AppPackageReadinessManager } from "@kernel/managers/app-package-readiness.manager.js";
import { AppPackageDependencyCoordinator } from "@kernel/services/app-package-dependency-coordinator.service.js";
import { AppPackageHostTargetService } from "@kernel/services/app-package-host-target.service.js";
import { AppPackagePresentationService } from "@kernel/services/app-package-presentation.service.js";
import { AppPackageRuntimeActivationService, EMPTY_APP_PACKAGE_RUNTIME_HOOKS } from "@kernel/services/app-package-runtime-activation.service.js";
import {
  AppPackageError,
  type AppPackageComponentSource,
  type AppPackageComponentSourceList,
  type AppPackageDependencyBindingInput,
  type AppPackageDependencyView,
  type AppPackageList,
  type AppPackageOperationInput,
  type AppPackageOperationList,
  type AppPackageOperationResult,
  type AppPackageOperationStatus,
  type AppPackageOperationView,
  type AppPackageRuntimeHooks,
  type AppPackageView,
  type AppPackageSecretReadiness,
  type CapabilityProviderView,
} from "@kernel/types/app-package.types.js";

export class AppPackageManager {
  private readonly appHomeService: AppHomeService;
  private readonly installationService: AppInstallationService;
  private readonly manifestService = new AppManifestService();
  private readonly operationManager: AppPackageOperationManager;
  private readonly hostTargetService = new AppPackageHostTargetService();
  private readonly presentationService = new AppPackagePresentationService();
  private readonly dependencyCoordinator: AppPackageDependencyCoordinator;
  private readonly runtimeActivationService = new AppPackageRuntimeActivationService();
  private readonly registryService: AppRegistryService;
  private readonly readinessManager: AppPackageReadinessManager;
  private runtimeHooks: AppPackageRuntimeHooks = EMPTY_APP_PACKAGE_RUNTIME_HOOKS;
  private builtInBootstrapPromise: Promise<void> | undefined;
  private builtInDefinitionsPromise: Promise<Array<{
    appDirectory: string;
    manifest: Awaited<ReturnType<AppManifestService["load"]>>;
  }>> | undefined;

  constructor(private readonly params: {
    appHomeDirectory: string;
    builtInAppsDirectory?: string;
    productVersion?: string;
    getSecretConfig?: () => Config;
    secretConfigPath?: string;
  }) {
    this.appHomeService = new AppHomeService(params.appHomeDirectory);
    this.installationService = new AppInstallationService(this.appHomeService);
    this.registryService = new AppRegistryService(this.appHomeService);
    this.dependencyCoordinator = new AppPackageDependencyCoordinator({
      installationService: this.installationService,
      registryService: this.registryService,
      listCapabilityProviders: async () => await this.runtimeHooks.listCapabilityProviders(),
      resolveSecurity: this.resolveSecurity,
    });
    this.readinessManager = new AppPackageReadinessManager({
      manifestService: this.manifestService,
      installationService: this.installationService,
      presentationService: this.presentationService,
      dependencyCoordinator: this.dependencyCoordinator,
      registryService: this.registryService,
      productVersion: params.productVersion,
      getSecretConfig: params.getSecretConfig,
      secretConfigPath: params.secretConfigPath,
      isBuiltInAppId: this.isBuiltInAppId,
    });
    this.operationManager = new AppPackageOperationManager({
      storePath: this.appHomeService.getOperationsPath(),
      execute: this.executeOperation,
    });
  }

  installRuntimeHooks = (hooks: Partial<AppPackageRuntimeHooks>): void => {
    this.runtimeHooks = { ...EMPTY_APP_PACKAGE_RUNTIME_HOOKS, ...hooks };
  };

  start = async (): Promise<void> => await this.ensureBuiltInPackages();

  listPackages = async (
    options: { includeStorageUsage?: boolean } = {},
  ): Promise<AppPackageList> => {
    const [records, providers] = await Promise.all([
      this.registryService.listApps(),
      this.runtimeHooks.listCapabilityProviders(),
    ]);
    const entries = (await Promise.all(records.map(async (record) =>
      await this.installationService.withAppOperation(record.appId, async () =>
        await this.readListedPackageView(
          record.appId,
          options.includeStorageUsage !== false,
          providers,
        ))))).filter((entry): entry is AppPackageView => entry !== undefined);
    return {
      hostTarget: this.hostTargetService.read(),
      entries,
    };
  };

  listInstalledDataOwners = async (): Promise<Array<{ id: string; name: string }>> =>
    (await this.registryService.listApps()).map((record) => ({
      id: record.appId,
      name: record.name,
    }));

  getPackage = async (appId: string): Promise<AppPackageView> => {
    return await this.installationService.withAppOperation(appId, async () => {
      try {
        return await this.readinessManager.toPackageView(await this.installationService.info(appId));
      } catch (error) {
        if (error instanceof Error && error.message.includes("未找到已安装应用")) {
          throw new AppPackageError("APP_PACKAGE_NOT_FOUND", error.message);
        }
        throw error;
      }
    });
  };

  inspectDependencies = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.installationService.withAppOperation(appId, async () => await this.dependencyCoordinator.inspect(appId));
  verifyDependencies = async (appId: string): Promise<AppPackageDependencyView> =>
    await this.installationService.withAppOperation(appId, async () => await this.dependencyCoordinator.verify(appId));
  setupDependencies = async (appId: string): Promise<AppPackageDependencyView> => await this.dependencyCoordinator.setup(appId);
  bindDependency = async (appId: string, input: AppPackageDependencyBindingInput): Promise<AppPackageDependencyView> =>
    await this.dependencyCoordinator.bind(appId, input);
  unbindDependency = async (appId: string, input: Omit<AppPackageDependencyBindingInput, "providerId">): Promise<AppPackageDependencyView> =>
    await this.dependencyCoordinator.unbind(appId, input);

  inspectSecrets = async (appId: string): Promise<AppPackageSecretReadiness> =>
    await this.installationService.withAppOperation(appId, async () =>
      await this.readinessManager.inspectSecrets(await this.installationService.info(appId), false));

  verifySecrets = async (appId: string): Promise<AppPackageSecretReadiness> =>
    await this.installationService.withAppOperation(appId, async () =>
      await this.readinessManager.inspectSecrets(await this.installationService.info(appId), true));

  bindSecret = async (
    appId: string,
    input: { slotId: string; binding: AppSecretBinding },
  ): Promise<AppPackageSecretReadiness> =>
    await this.installationService.withAppOperation(appId, async () => {
      try {
        await this.registryService.bindSecret(appId, input.slotId, input.binding);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("未声明 Secret slot")) {
          throw new AppPackageError("SECRET_SLOT_NOT_DECLARED", message);
        }
        throw new AppPackageError("SECRET_RESOLUTION_FAILED", message);
      }
      return await this.inspectSecrets(appId);
    });

  unbindSecret = async (
    appId: string,
    slotId: string,
  ): Promise<AppPackageSecretReadiness> =>
    await this.installationService.withAppOperation(appId, async () => {
      await this.registryService.unbindSecret(appId, slotId);
      return await this.inspectSecrets(appId);
    });

  listActiveComponentSources = async (): Promise<AppPackageComponentSource[]> =>
    (await this.listActiveComponentSourcesWithDiagnostics()).sources;

  listActiveComponentSourcesWithDiagnostics = async (): Promise<AppPackageComponentSourceList> =>
    await this.dependencyCoordinator.listActiveComponentSourcesWithDiagnostics();

  listOperations = async (): Promise<AppPackageOperationList> =>
    await this.operationManager.list();

  startOperation = async (
    input: AppPackageOperationInput,
  ): Promise<AppPackageOperationView> => {
    await this.ensureBuiltInPackages();
    return await this.operationManager.start(input);
  };

  install = async (
    source: string,
    registryUrl?: string,
    onProgress?: AppInstallProgressHandler,
  ): Promise<AppPackageView> => {
    const result = await this.installationService.install(source, { registryUrl, onProgress });
    if (await this.isBuiltInAppId(result.appId)) {
      await this.registryService.setBuiltInSuppressed(result.appId, false);
    }
    return await this.getPackage(result.appId);
  };

  enable = async (appId: string): Promise<AppPackageView> => {
    return await this.installationService.withAppOperation(appId, async () => {
    const app = await this.getPackage(appId);
    await this.installationService.assertVersionIntegrity(appId, app.activeVersion);
    if (app.enabled) {
      return app;
    }
    this.readinessManager.assertSecretsReady(app);
    this.dependencyCoordinator.assertReadyToEnable(app);
    await this.readinessManager.assertEngineCompatibility(appId);
    const sources = this.toComponentSources(app);
    await this.runtimeHooks.assertCanActivate(sources);
    await this.installationService.setEnabled(appId, true);
    try {
      await this.runtimeHooks.afterActivate(sources);
    } catch (error) {
      await this.runtimeActivationService.recoverFailedActivation({
        appId, error, sources,
        beforeDeactivate: this.runtimeHooks.beforeDeactivate,
        disable: async () => {
          await this.installationService.setEnabled(appId, false);
        },
      });
      throw error;
    }
    return await this.getPackage(appId);
    });
  };

  disable = async (appId: string): Promise<AppPackageView> => {
    return await this.installationService.withAppOperation(appId, async () => {
    const app = await this.getPackage(appId);
    if (!app.enabled) {
      return app;
    }
    await this.dependencyCoordinator.assertNoEnabledDependents(app);
    await this.runtimeHooks.beforeDeactivate(this.toComponentSources(app));
    await this.installationService.setEnabled(appId, false);
    return await this.getPackage(appId);
    });
  };

  update = async (
    appId: string,
    options: {
      version?: string;
      registryUrl?: string;
      onProgress?: AppInstallProgressHandler;
    } = {},
  ): Promise<{ package: AppPackageView; result: AppUpdateResult }> => {
    return await this.installationService.withAppOperation(appId, async () => {
    const current = await this.getPackage(appId);
    const result = await this.installationService.update(appId, {
      ...options,
      activate: false,
    });
    if (!result.updated) {
      return { package: current, result };
    }
    await this.dependencyCoordinator.assertNoEnabledDependents(current);
    let activated = false;
    let deactivated = false;
    try {
      await this.readinessManager.assertEngineCompatibility(appId, result.version);
      const candidate = await this.readinessManager.toPackageView(
        await this.installationService.info(appId),
        result.version,
      );
      if (current.enabled) {
        this.readinessManager.assertSecretsReady(candidate);
        this.dependencyCoordinator.assertReadyToEnable(candidate);
        await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
        deactivated = true;
        await this.runtimeHooks.assertCanActivate(this.toComponentSources(candidate));
      }
      const activation = await this.installationService.rollback(appId, result.version);
      activated = activation.rolledBack;
      if (current.enabled) {
        await this.runtimeHooks.afterActivate(this.toComponentSources(candidate));
      }
      return { package: await this.getPackage(appId), result };
    } catch (error) {
      if (activated) {
        await this.installationService.rollback(appId, result.previousVersion);
      }
      if (deactivated) {
        try {
          await this.runtimeHooks.assertCanActivate(this.toComponentSources(current));
          await this.runtimeHooks.afterActivate(this.toComponentSources(current));
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            `应用 ${appId} 更新失败，且旧 runtime 恢复探测失败。`,
          );
        }
      }
      throw error;
    }
    });
  };

  rollback = async (
    appId: string,
    version: string,
  ): Promise<{ package: AppPackageView; result: AppRollbackResult }> => {
    return await this.installationService.withAppOperation(appId, async () => {
    const current = await this.getPackage(appId);
    if (current.activeVersion === version) {
      return {
        package: current,
        result: {
          appId,
          activeVersion: version,
          previousVersion: version,
          enabled: current.enabled,
          rolledBack: false,
        },
      };
    }
    await this.dependencyCoordinator.assertNoEnabledDependents(current);
    await this.readinessManager.assertEngineCompatibility(appId, version);
    const candidate = await this.readinessManager.toPackageView(
      await this.installationService.info(appId),
      version,
    );
    let deactivated = false;
    let result: AppRollbackResult | undefined;
    try {
      if (current.enabled) {
        this.readinessManager.assertSecretsReady(candidate);
        this.dependencyCoordinator.assertReadyToEnable(candidate);
        await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
        deactivated = true;
        await this.runtimeHooks.assertCanActivate(this.toComponentSources(candidate));
      }
      result = await this.installationService.rollback(appId, version);
      if (current.enabled) {
        await this.runtimeHooks.afterActivate(this.toComponentSources(candidate));
      }
      return { package: await this.getPackage(appId), result };
    } catch (error) {
      if (result?.rolledBack) {
        await this.installationService.rollback(appId, result.previousVersion);
      }
      if (deactivated) {
        try {
          await this.runtimeHooks.assertCanActivate(this.toComponentSources(current));
          await this.runtimeHooks.afterActivate(this.toComponentSources(current));
        } catch (recoveryError) {
          throw new AggregateError(
            [error, recoveryError],
            `应用 ${appId} 回滚失败，且旧 runtime 恢复探测失败。`,
          );
        }
      }
      throw error;
    }
    });
  };

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppUninstallResult> => {
    return await this.installationService.withAppOperation(appId, async () => {
    const current = await this.getPackage(appId);
    await this.dependencyCoordinator.assertNoEnabledDependents(current);
    if (current.builtIn) {
      await this.registryService.setBuiltInSuppressed(appId, true);
    }
    let rollbackRuntimeState: (() => Promise<void>) | undefined;
    try {
      const sources = this.toComponentSources(current);
      const preparedRollback = await this.runtimeHooks.beforeUninstall(sources);
      rollbackRuntimeState = preparedRollback || undefined;
      return await this.installationService.uninstall(appId, purgeData);
    } catch (error) {
      const recoveryErrors: unknown[] = [];
      if (rollbackRuntimeState) {
        try {
          await rollbackRuntimeState();
        } catch (recoveryError) {
          recoveryErrors.push(recoveryError);
        }
      }
      if (current.builtIn) {
        try {
          await this.registryService.setBuiltInSuppressed(appId, false);
        } catch (recoveryError) {
          recoveryErrors.push(recoveryError);
        }
      }
      if (recoveryErrors.length > 0) {
        throw new AggregateError(
          [error, ...recoveryErrors],
          `应用 ${appId} 卸载失败，且 runtime 状态恢复未完整完成。`,
        );
      }
      throw error;
    }
    });
  };

  private ensureBuiltInPackages = async (): Promise<void> => {
    this.builtInBootstrapPromise ??= this.installBuiltInPackages();
    await this.builtInBootstrapPromise;
  };

  private installBuiltInPackages = async (): Promise<void> => {
    await this.installationService.reconcileFilesystem();
    for (const { appDirectory, manifest } of await this.listBuiltInDefinitions()) {
      if (!isAppComponentManifestBundle(manifest)) {
        continue;
      }
      if (await this.registryService.isBuiltInSuppressed(manifest.manifest.id)) {
        continue;
      }
      const existing = await this.registryService.getApp(manifest.manifest.id);
      if (existing?.installedVersions[manifest.manifest.version]) {
        continue;
      }
      await this.installationService.install(appDirectory, {
        trustedPublisher: {
          id: "nextclaw",
          name: "NextClaw",
          url: "https://nextclaw.io",
        },
      });
    }
  };

  private readListedPackageView = async (
    appId: string,
    measureStorageUsage: boolean,
    providers: CapabilityProviderView[],
  ): Promise<AppPackageView | undefined> => {
    try {
      return await this.readinessManager.toPackageView(await this.installationService.info(
        appId,
        { measureStorageUsage },
      ), undefined, providers);
    } catch (error) {
      if (this.isTransientUninstallRead(error) && !await this.registryService.getApp(appId)) {
        return undefined;
      }
      throw error;
    }
  };

  private resolveSecurity = (
    version: NonNullable<Awaited<ReturnType<AppRegistryService["getApp"]>>>["installedVersions"][string],
    appId: string,
  ): Pick<AppPackageComponentSource, "runtimeProfile" | "isolation" | "permissions"> => {
    if (version.security) {
      return {
        runtimeProfile: version.security.runtimeProfile,
        isolation: version.security.isolation,
        permissions: version.security.permissions,
      };
    }
    const hasService = version.components?.some((component) => component.kind === "service") ?? false;
    if (version.manifestSchemaVersion !== 2) {
      throw new AppPackageError(
        "APP_PACKAGE_INCOMPATIBLE",
        `应用 ${appId} 仍使用 legacy schema，不能投影组件。`,
      );
    }
    return hasService
      ? { runtimeProfile: "native-process", isolation: "full-user", permissions: {} }
      : { runtimeProfile: "panel-only", isolation: "sandboxed", permissions: {} };
  };

  private toComponentSources = (app: AppPackageView): AppPackageComponentSource[] =>
    app.components.map((component) => ({ ...component }));

  private listBuiltInDefinitions = async (): Promise<Array<{
    appDirectory: string;
    manifest: Awaited<ReturnType<AppManifestService["load"]>>;
  }>> => {
    if (!this.params.builtInAppsDirectory) {
      return [];
    }
    this.builtInDefinitionsPromise ??= (async () => {
      const builtInDirectory = path.resolve(this.params.builtInAppsDirectory as string);
      let entries;
      try {
        entries = await readdir(builtInDirectory, { withFileTypes: true });
      } catch (error) {
        if (this.isMissingFileError(error)) {
          return [];
        }
        throw error;
      }
      return await Promise.all(entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map(async (entry) => {
          const appDirectory = path.join(builtInDirectory, entry.name);
          return {
            appDirectory,
            manifest: await this.manifestService.load(appDirectory),
          };
        }));
    })();
    return await this.builtInDefinitionsPromise;
  };

  private isBuiltInAppId = async (appId: string): Promise<boolean> =>
    (await this.listBuiltInDefinitions()).some(({ manifest }) => manifest.manifest.id === appId);

  private executeOperation = async (
    input: AppPackageOperationInput,
    report: (status: AppPackageOperationStatus) => Promise<void>,
  ): Promise<AppPackageOperationResult> => {
    if (input.action === "install") {
      const installed = await this.install(
        input.source,
        input.registryUrl,
        async (phase) => await report(phase),
      );
      return { appId: installed.id, activeVersion: installed.activeVersion };
    }
    if (input.action === "update") {
      const updated = await this.update(input.appId, {
        version: input.version,
        registryUrl: input.registryUrl,
        onProgress: async (phase) => await report(phase),
      });
      return {
        appId: updated.package.id,
        activeVersion: updated.package.activeVersion,
        changed: updated.result.updated,
      };
    }
    await report("resolving");
    if (input.action === "rollback") {
      await report("verifying");
      await report("installing");
      const rolledBack = await this.rollback(input.appId, input.version);
      await report("finalizing");
      return {
        appId: rolledBack.package.id,
        activeVersion: rolledBack.package.activeVersion,
        changed: rolledBack.result.rolledBack,
      };
    }
    await report("installing");
    const uninstalled = await this.uninstall(
      input.appId,
      input.purgeData ?? false,
    );
    await report("finalizing");
    return {
      appId: uninstalled.appId,
      removedVersions: uninstalled.removedVersions,
      dataRemoved: uninstalled.dataRemoved,
    };
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";

  private isTransientUninstallRead = (error: unknown): boolean =>
    this.isMissingFileError(error) ||
    (error instanceof Error && error.message.includes("未找到已安装应用"));
}
