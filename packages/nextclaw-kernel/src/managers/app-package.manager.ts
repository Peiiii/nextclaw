import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  AppHomeService,
  AppInstallationService,
  AppManifestService,
  AppRegistryService,
  isAppComponentManifestBundle,
} from "@nextclaw/app-runtime";
import type {
  AppInfoResult,
  AppInstallProgressHandler,
  AppRollbackResult,
  AppUninstallResult,
  AppUpdateResult,
} from "@nextclaw/app-runtime";
import { AppPackageOperationManager } from "@kernel/managers/app-package-operation.manager.js";
import { AppPackageHostTargetService } from "@kernel/services/app-package-host-target.service.js";
import { AppPackagePresentationService } from "@kernel/services/app-package-presentation.service.js";
import { AppPackageReadinessService } from "@kernel/services/app-package-readiness.service.js";
import { AppPackageRuntimeActivationService, EMPTY_APP_PACKAGE_RUNTIME_HOOKS } from "@kernel/services/app-package-runtime-activation.service.js";
import {
  AppPackageError,
  type AppPackageComponentSource,
  type AppPackageComponentSourceList,
  type AppPackageList,
  type AppPackageOperationInput,
  type AppPackageOperationList,
  type AppPackageOperationResult,
  type AppPackageOperationStatus,
  type AppPackageOperationView,
  type AppPackageRuntimeHooks,
  type AppPackageView,
} from "@kernel/types/app-package.types.js";
import { satisfiesAppEngineVersion } from "@kernel/utils/app-engine-version.utils.js";

export class AppPackageManager {
  private readonly appHomeService: AppHomeService;
  private readonly installationService: AppInstallationService;
  private readonly manifestService = new AppManifestService();
  private readonly operationManager: AppPackageOperationManager;
  private readonly hostTargetService = new AppPackageHostTargetService();
  private readonly presentationService = new AppPackagePresentationService();
  private readonly readinessService = new AppPackageReadinessService();
  private readonly runtimeActivationService = new AppPackageRuntimeActivationService();
  private readonly registryService: AppRegistryService;
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
  }) {
    this.appHomeService = new AppHomeService(params.appHomeDirectory);
    this.installationService = new AppInstallationService(this.appHomeService);
    this.registryService = new AppRegistryService(this.appHomeService);
    this.operationManager = new AppPackageOperationManager({
      storePath: this.appHomeService.getOperationsPath(),
      execute: this.executeOperation,
    });
  }

  installRuntimeHooks = (hooks: AppPackageRuntimeHooks): void => {
    this.runtimeHooks = hooks;
  };

  start = async (): Promise<void> => await this.ensureBuiltInPackages();

  listPackages = async (
    options: { includeStorageUsage?: boolean } = {},
  ): Promise<AppPackageList> => {
    const records = await this.registryService.listApps();
    return {
      hostTarget: this.hostTargetService.read(),
      entries: await Promise.all(records.map(async (record) =>
        await this.toPackageView(await this.installationService.info(
          record.appId,
          { measureStorageUsage: options.includeStorageUsage !== false },
        )))),
    };
  };

  listInstalledDataOwners = async (): Promise<Array<{ id: string; name: string }>> =>
    (await this.registryService.listApps()).map((record) => ({
      id: record.appId,
      name: record.name,
    }));

  getPackage = async (appId: string): Promise<AppPackageView> => {
    try {
      return await this.toPackageView(await this.installationService.info(appId));
    } catch (error) {
      if (error instanceof Error && error.message.includes("未找到已安装应用")) {
        throw new AppPackageError("APP_PACKAGE_NOT_FOUND", error.message);
      }
      throw error;
    }
  };

  listActiveComponentSources = async (): Promise<AppPackageComponentSource[]> =>
    (await this.listActiveComponentSourcesWithDiagnostics()).sources;

  listActiveComponentSourcesWithDiagnostics = async (): Promise<AppPackageComponentSourceList> => {
    const records = await this.registryService.listApps();
    const results = await Promise.all(records
      .filter((record) => record.enabled)
      .map(async (record) => {
        try {
          await this.installationService.assertVersionIntegrity(record.appId, record.activeVersion);
          const version = record.installedVersions[record.activeVersion];
          if (!version || version.manifestSchemaVersion !== 2) return { sources: [] };
          return { sources: (version.components ?? []).map((component) => ({
            kind: component.kind, id: component.id, packageId: record.appId,
            packageVersion: record.activeVersion, sourcePath: component.componentDirectory,
            manifestPath: component.manifestPath, dataDirectory: record.dataDirectory,
            instanceId: record.defaultInstance.id, storage: record.defaultInstance.storage,
            ...this.resolveSecurity(version, record.appId),
          })) };
        } catch (error) {
          return { sources: [], unavailablePackage: {
            appId: record.appId,
            message: error instanceof Error ? error.message : String(error),
          } };
        }
      }));
    return {
      sources: results.flatMap((result) => result.sources),
      unavailablePackages: results.flatMap((result) => result.unavailablePackage ?? []),
    };
  };

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
    this.readinessService.assertReadyToEnable(app);
    await this.assertEngineCompatibility(appId);
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
    let activated = false;
    let deactivated = false;
    try {
      await this.assertEngineCompatibility(appId, result.version);
      const candidate = await this.toPackageView(
        await this.installationService.info(appId),
        result.version,
      );
      if (current.enabled) {
        this.readinessService.assertReadyToEnable(candidate);
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
    await this.assertEngineCompatibility(appId, version);
    const candidate = await this.toPackageView(
      await this.installationService.info(appId),
      version,
    );
    let deactivated = false;
    let result: AppRollbackResult | undefined;
    try {
      if (current.enabled) {
        this.readinessService.assertReadyToEnable(candidate);
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

  private toPackageView = async (
    info: AppInfoResult,
    selectedVersion: string = info.activeVersion,
  ): Promise<AppPackageView> => {
    const activeVersion = info.installedVersions.find(
      (version) => version.version === selectedVersion,
    );
    if (!activeVersion) {
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${info.appId} 缺少版本 ${selectedVersion}。`,
      );
    }
    const packagePresentation = await this.presentationService.readManifest(
      path.join(activeVersion.installDirectory, "manifest.json"),
    );
    const manifestBundle = await this.manifestService.load(activeVersion.installDirectory);
    const security = manifestBundle.manifest.schemaVersion === 2
      ? this.manifestService.resolvePlatformSecurity(manifestBundle.manifest)
      : {
          runtimeProfile: "wasi" as const,
          isolation: manifestBundle.manifest.main.kind === "wasi-http-component"
            ? "host-mediated" as const
            : "sandboxed" as const,
          permissions: manifestBundle.manifest.permissions ?? {},
        };
    const readiness = await this.readinessService.resolve(activeVersion.components ?? []);
    return {
      id: info.appId,
      name: info.name,
      description: info.description,
      icon: packagePresentation.icon,
      nameI18n: packagePresentation.nameI18n,
      descriptionI18n: packagePresentation.descriptionI18n,
      activeVersion: selectedVersion,
      installedVersions: info.installedVersions.map((version) => version.version),
      enabled: info.enabled,
      builtIn: await this.isBuiltInAppId(info.appId),
      primaryPanelId: activeVersion.primaryPanelId,
      components: await Promise.all((activeVersion.components ?? []).map(async (component) => ({
        kind: component.kind,
        id: component.id,
        packageId: info.appId,
        packageVersion: selectedVersion,
        sourcePath: component.componentDirectory,
        manifestPath: component.manifestPath,
        dataDirectory: info.dataDirectory,
        instanceId: info.instance.id,
        storage: info.storage,
        runtimeProfile: security.runtimeProfile,
        isolation: security.isolation,
        permissions: security.permissions,
        ...await this.presentationService.readManifest(component.manifestPath),
      }))),
      dataDirectory: info.dataDirectory,
      instanceId: info.instance.id,
      storage: info.storage,
      storageUsage: info.storageUsage,
      runtimeProfile: security.runtimeProfile,
      isolation: security.isolation,
      readiness,
    };
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

  private assertEngineCompatibility = async (
    appId: string,
    selectedVersion?: string,
  ): Promise<void> => {
    const productVersion = this.params.productVersion?.trim();
    if (!productVersion) {
      return;
    }
    const info = await this.installationService.info(appId);
    const targetVersion = selectedVersion ?? info.activeVersion;
    const activeVersion = info.installedVersions.find(
      (version) => version.version === targetVersion,
    );
    if (!activeVersion) {
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${appId} 缺少版本 ${targetVersion}。`,
      );
    }
    const manifestBundle = await this.manifestService.load(activeVersion.installDirectory);
    const engineRange = manifestBundle.manifest.schemaVersion === 2
      ? manifestBundle.manifest.engines?.nextclaw?.trim()
      : undefined;
    if (engineRange && !satisfiesAppEngineVersion(productVersion, engineRange)) {
      throw new AppPackageError(
        "APP_PACKAGE_INCOMPATIBLE",
        `应用 ${appId}@${targetVersion} 要求 NextClaw ${engineRange}，当前版本为 ${productVersion}。`,
      );
    }
  };

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
}
