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
  AppRollbackResult,
  AppUninstallResult,
  AppUpdateResult,
} from "@nextclaw/app-runtime";
import {
  AppPackageError,
  type AppPackageComponentSource,
  type AppPackageList,
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
  private readonly installationService: AppInstallationService;
  private readonly manifestService = new AppManifestService();
  private readonly registryService: AppRegistryService;
  private runtimeHooks: AppPackageRuntimeHooks = EMPTY_RUNTIME_HOOKS;
  private builtInBootstrapPromise: Promise<void> | undefined;

  constructor(private readonly params: {
    appHomeDirectory: string;
    builtInAppsDirectory?: string;
    productVersion?: string;
  }) {
    const appHomeService = new AppHomeService(params.appHomeDirectory);
    this.installationService = new AppInstallationService(appHomeService);
    this.registryService = new AppRegistryService(appHomeService);
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

  install = async (source: string, registryUrl?: string): Promise<AppPackageView> => {
    const result = await this.installationService.install(source, { registryUrl });
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
    options: { version?: string; registryUrl?: string } = {},
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
    if (current.enabled) {
      await this.runtimeHooks.beforeDeactivate(this.toComponentSources(current));
    }
    await this.runtimeHooks.beforeUninstall(this.toComponentSources(current));
    return await this.installationService.uninstall(appId, purgeData);
  };

  private ensureBuiltInPackages = async (): Promise<void> => {
    if (!this.params.builtInAppsDirectory) {
      return;
    }
    this.builtInBootstrapPromise ??= this.installBuiltInPackages();
    await this.builtInBootstrapPromise;
  };

  private installBuiltInPackages = async (): Promise<void> => {
    const builtInDirectory = path.resolve(this.params.builtInAppsDirectory as string);
    let entries;
    try {
      entries = await readdir(builtInDirectory, { withFileTypes: true });
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return;
      }
      throw error;
    }
    for (const entry of entries.filter((item) => item.isDirectory() && !item.name.startsWith("."))) {
      const appDirectory = path.join(builtInDirectory, entry.name);
      const manifest = await this.manifestService.load(appDirectory);
      if (!isAppComponentManifestBundle(manifest)) {
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
      nameI18n: packagePresentation.nameI18n,
      descriptionI18n: packagePresentation.descriptionI18n,
      activeVersion: info.activeVersion,
      installedVersions: info.installedVersions.map((version) => version.version),
      enabled: info.enabled,
      builtIn: this.isBuiltInSource(activeVersion.sourceRef),
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
    return {
      ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
      ...(typeof candidate.description === "string"
        ? { description: candidate.description }
        : {}),
      ...(typeof candidate.icon === "string" ? { icon: candidate.icon } : {}),
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

  private isBuiltInSource = (sourceRef: string): boolean => {
    if (!this.params.builtInAppsDirectory) {
      return false;
    }
    const relative = path.relative(
      path.resolve(this.params.builtInAppsDirectory),
      path.resolve(sourceRef),
    );
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
