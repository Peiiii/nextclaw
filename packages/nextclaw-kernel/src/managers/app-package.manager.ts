import { readFile, readdir } from "node:fs/promises";
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
import {
  AppPackageError,
  type AppPackageComponentSource,
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

const EMPTY_RUNTIME_HOOKS: AppPackageRuntimeHooks = {
  assertCanActivate: async () => undefined,
  beforeDeactivate: async () => undefined,
  beforeUninstall: async () => undefined,
};

export class AppPackageManager {
  private readonly appHomeService: AppHomeService;
  private readonly installationService: AppInstallationService;
  private readonly manifestService = new AppManifestService();
  private readonly operationManager: AppPackageOperationManager;
  private readonly registryService: AppRegistryService;
  private runtimeHooks: AppPackageRuntimeHooks = EMPTY_RUNTIME_HOOKS;
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

  listPackages = async (): Promise<AppPackageList> => {
    await this.ensureBuiltInPackages();
    const records = await this.registryService.listApps();
    return {
      entries: await Promise.all(records.map(async (record) =>
        await this.toPackageView(await this.installationService.info(record.appId)))),
    };
  };

  getPackage = async (appId: string): Promise<AppPackageView> => {
    await this.ensureBuiltInPackages();
    try {
      return await this.toPackageView(await this.installationService.info(appId));
    } catch (error) {
      if (error instanceof Error && error.message.includes("未找到已安装应用")) {
        throw new AppPackageError("APP_PACKAGE_NOT_FOUND", error.message);
      }
      throw error;
    }
  };

  listActiveComponentSources = async (): Promise<AppPackageComponentSource[]> => {
    await this.ensureBuiltInPackages();
    const records = await this.registryService.listApps();
    return records
      .filter((record) => record.enabled)
      .flatMap((record) => {
        const version = record.installedVersions[record.activeVersion];
        if (!version || version.manifestSchemaVersion !== 2) {
          return [];
        }
        return (version.components ?? []).map((component) => ({
          kind: component.kind,
          id: component.id,
          packageId: record.appId,
          packageVersion: record.activeVersion,
          sourcePath: component.componentDirectory,
          manifestPath: component.manifestPath,
          dataDirectory: record.dataDirectory,
        }));
      });
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
    const app = await this.getPackage(appId);
    if (app.enabled) {
      return app;
    }
    await this.assertEngineCompatibility(appId);
    const sources = this.toComponentSources(app);
    await this.runtimeHooks.assertCanActivate(sources);
    await this.installationService.setEnabled(appId, true);
    return await this.getPackage(appId);
  };

  disable = async (appId: string): Promise<AppPackageView> => {
    const app = await this.getPackage(appId);
    if (!app.enabled) {
      return app;
    }
    await this.runtimeHooks.beforeDeactivate(this.toComponentSources(app));
    await this.installationService.setEnabled(appId, false);
    return await this.getPackage(appId);
  };

  update = async (
    appId: string,
    options: {
      version?: string;
      registryUrl?: string;
      onProgress?: AppInstallProgressHandler;
    } = {},
  ): Promise<{ package: AppPackageView; result: AppUpdateResult }> => {
    const current = await this.getPackage(appId);
    if (current.enabled) {
      await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
    }
    const result = await this.installationService.update(appId, options);
    try {
      await this.assertEngineCompatibility(appId);
      const updated = await this.getPackage(appId);
      if (updated.enabled) {
        await this.runtimeHooks.assertCanActivate(this.toComponentSources(updated));
      }
      return { package: updated, result };
    } catch (error) {
      if (result.updated) {
        await this.installationService.rollback(appId, result.previousVersion);
      }
      throw error;
    }
  };

  rollback = async (
    appId: string,
    version: string,
  ): Promise<{ package: AppPackageView; result: AppRollbackResult }> => {
    const current = await this.getPackage(appId);
    if (current.enabled) {
      await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
    }
    const result = await this.installationService.rollback(appId, version);
    try {
      await this.assertEngineCompatibility(appId);
      const rolledBack = await this.getPackage(appId);
      if (rolledBack.enabled) {
        await this.runtimeHooks.assertCanActivate(this.toComponentSources(rolledBack));
      }
      return { package: rolledBack, result };
    } catch (error) {
      if (result.rolledBack) {
        await this.installationService.rollback(appId, result.previousVersion);
      }
      throw error;
    }
  };

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppUninstallResult> => {
    const current = await this.getPackage(appId);
    if (current.builtIn) {
      await this.registryService.setBuiltInSuppressed(appId, true);
    }
    try {
      if (current.enabled) {
        await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
      }
      await this.runtimeHooks.beforeUninstall(this.toComponentSources(current));
      return await this.installationService.uninstall(appId, purgeData);
    } catch (error) {
      if (current.builtIn) {
        await this.registryService.setBuiltInSuppressed(appId, false);
      }
      throw error;
    }
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
      await this.installationService.install(appDirectory);
    }
  };

  private toPackageView = async (info: AppInfoResult): Promise<AppPackageView> => {
    const activeVersion = info.installedVersions.find(
      (version) => version.version === info.activeVersion,
    );
    if (!activeVersion) {
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${info.appId} 缺少激活版本 ${info.activeVersion}。`,
      );
    }
    const packagePresentation = await this.readManifestPresentation(
      path.join(activeVersion.installDirectory, "manifest.json"),
    );
    return {
      id: info.appId,
      name: info.name,
      description: info.description,
      icon: packagePresentation.icon,
      nameI18n: packagePresentation.nameI18n,
      descriptionI18n: packagePresentation.descriptionI18n,
      activeVersion: info.activeVersion,
      installedVersions: info.installedVersions.map((version) => version.version),
      enabled: info.enabled,
      builtIn: await this.isBuiltInAppId(info.appId),
      primaryPanelId: activeVersion.primaryPanelId,
      components: await Promise.all((activeVersion.components ?? []).map(async (component) => ({
        kind: component.kind,
        id: component.id,
        packageId: info.appId,
        packageVersion: info.activeVersion,
        sourcePath: component.componentDirectory,
        manifestPath: component.manifestPath,
        dataDirectory: info.dataDirectory,
        ...await this.readManifestPresentation(component.manifestPath),
      }))),
      dataDirectory: info.dataDirectory,
    };
  };

  private readManifestPresentation = async (
    manifestPath: string,
  ): Promise<{
    title?: string;
    description?: string;
    icon?: string;
    nameI18n?: Record<string, string>;
    titleI18n?: Record<string, string>;
    descriptionI18n?: Record<string, string>;
  }> => {
    const candidate = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    const rawIcon = typeof candidate.icon === "string" ? candidate.icon : undefined;
    return {
      ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
      ...(typeof candidate.description === "string"
        ? { description: candidate.description }
        : {}),
      ...(rawIcon ? { icon: await this.resolvePresentationIcon(manifestPath, rawIcon) } : {}),
      ...this.readLocalizedField(candidate, "nameI18n"),
      ...this.readLocalizedField(candidate, "titleI18n"),
      ...this.readLocalizedField(candidate, "descriptionI18n"),
    };
  };

  private readLocalizedField = (
    candidate: Record<string, unknown>,
    field: "nameI18n" | "titleI18n" | "descriptionI18n",
  ): Partial<Record<typeof field, Record<string, string>>> => {
    const value = candidate[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const entries = Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    return entries.length > 0 ? { [field]: Object.fromEntries(entries) } : {};
  };

  private toComponentSources = (app: AppPackageView): AppPackageComponentSource[] =>
    app.components.map((component) => ({ ...component }));

  private assertEngineCompatibility = async (appId: string): Promise<void> => {
    const productVersion = this.params.productVersion?.trim();
    if (!productVersion) {
      return;
    }
    const info = await this.installationService.info(appId);
    const activeVersion = info.installedVersions.find(
      (version) => version.version === info.activeVersion,
    );
    if (!activeVersion) {
      throw new AppPackageError(
        "APP_PACKAGE_OPERATION_FAILED",
        `应用 ${appId} 缺少激活版本 ${info.activeVersion}。`,
      );
    }
    const manifestBundle = await this.manifestService.load(activeVersion.installDirectory);
    const engineRange = manifestBundle.manifest.schemaVersion === 2
      ? manifestBundle.manifest.engines?.nextclaw?.trim()
      : undefined;
    if (engineRange && !satisfiesAppEngineVersion(productVersion, engineRange)) {
      throw new AppPackageError(
        "APP_PACKAGE_INCOMPATIBLE",
        `应用 ${appId}@${info.activeVersion} 要求 NextClaw ${engineRange}，当前版本为 ${productVersion}。`,
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

  private resolvePresentationIcon = async (
    manifestPath: string,
    icon: string,
  ): Promise<string> => {
    if (
      icon.startsWith("data:") ||
      icon.startsWith("http://") ||
      icon.startsWith("https://") ||
      icon.startsWith("/") ||
      (!icon.includes("/") && !icon.includes(".") && [...icon].length <= 8)
    ) {
      return icon;
    }
    const manifestDirectory = path.dirname(manifestPath);
    const iconPath = path.resolve(manifestDirectory, icon);
    const relative = path.relative(manifestDirectory, iconPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return icon;
    }
    const mimeType = this.iconMimeType(path.extname(iconPath));
    if (!mimeType) {
      return icon;
    }
    const bytes = await readFile(iconPath);
    if (bytes.byteLength > 256 * 1024) {
      return icon;
    }
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  };

  private iconMimeType = (extension: string): string | undefined => {
    switch (extension.toLowerCase()) {
      case ".svg": return "image/svg+xml";
      case ".png": return "image/png";
      case ".jpg":
      case ".jpeg": return "image/jpeg";
      case ".webp": return "image/webp";
      case ".gif": return "image/gif";
      default: return undefined;
    }
  };

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
