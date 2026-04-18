import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "../bundle/app-bundle.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppHomeService } from "../paths/app-home.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";
import { AppRegistryService } from "../registry/app-registry.service.js";
import type {
  AppInfoResult,
  AppInstallResult,
  AppLaunchResolution,
  AppUninstallResult,
  InstalledAppListItem,
} from "./app-installation.types.js";

export class AppInstallationService {
  constructor(
    private readonly appHomeService: AppHomeService = new AppHomeService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly registryService: AppRegistryService = new AppRegistryService(appHomeService),
  ) {}

  install = async (appSource: string): Promise<AppInstallResult> => {
    const normalizedSource = path.resolve(appSource);
    const sourceType = await this.detectSourceType(normalizedSource);
    if (sourceType === "missing") {
      throw new Error(`无法识别安装源：${appSource}`);
    }
    const tempDirectory = await this.appHomeService.createTemporaryDirectory("napp-install-");
    try {
      const bundlePath =
        sourceType === "directory"
          ? (await this.bundleService.packAppDirectory({
              appDirectory: normalizedSource,
              outputPath: path.join(tempDirectory, "app.napp"),
            })).bundlePath
          : normalizedSource;
      const extractedDirectory = path.join(tempDirectory, "bundle");
      await this.bundleService.extractBundle({
        bundlePath,
        targetDirectory: extractedDirectory,
      });
      const manifestBundle = await this.manifestService.load(extractedDirectory);
      const installDirectory = this.appHomeService.getInstallDirectory(
        manifestBundle.manifest.id,
        manifestBundle.manifest.version,
      );
      const dataDirectory = this.appHomeService.getAppDataDirectory(manifestBundle.manifest.id);
      await rm(installDirectory, { recursive: true, force: true });
      await mkdir(path.dirname(installDirectory), { recursive: true });
      await mkdir(dataDirectory, { recursive: true });
      await cp(extractedDirectory, installDirectory, { recursive: true });
      const registryRecord = await this.registryService.upsertInstallation({
        appId: manifestBundle.manifest.id,
        name: manifestBundle.manifest.name,
        description: manifestBundle.manifest.description,
        version: manifestBundle.manifest.version,
        installDirectory,
        dataDirectory,
        sourceKind: sourceType,
        sourceRef: normalizedSource,
        installedAt: new Date().toISOString(),
        permissions: manifestBundle.manifest.permissions ?? {},
      });
      return {
        appId: registryRecord.appId,
        name: registryRecord.name,
        version: registryRecord.activeVersion,
        installDirectory,
        dataDirectory,
        sourceKind: sourceType,
        sourceRef: normalizedSource,
        permissions:
          registryRecord.installedVersions[registryRecord.activeVersion]?.permissions ?? {},
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppUninstallResult> => {
    const appRecord = await this.registryService.removeApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const removedVersions = Object.keys(appRecord.installedVersions).sort((left, right) =>
      left.localeCompare(right),
    );
    await Promise.all(
      Object.values(appRecord.installedVersions).map((versionRecord) =>
        rm(versionRecord.installDirectory, { recursive: true, force: true }),
      ),
    );
    if (purgeData) {
      await rm(appRecord.dataDirectory, { recursive: true, force: true });
    }
    return {
      appId,
      removedVersions,
      dataRemoved: purgeData,
    };
  };

  list = async (): Promise<InstalledAppListItem[]> => {
    const appRecords = await this.registryService.listApps();
    return appRecords.map((appRecord) => ({
      appId: appRecord.appId,
      name: appRecord.name,
      activeVersion: appRecord.activeVersion,
    }));
  };

  info = async (appId: string): Promise<AppInfoResult> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const installedVersions = Object.values(appRecord.installedVersions).sort((left, right) =>
      left.version.localeCompare(right.version),
    );
    return {
      appId: appRecord.appId,
      name: appRecord.name,
      description: appRecord.description,
      activeVersion: appRecord.activeVersion,
      dataDirectory: appRecord.dataDirectory,
      installedVersions: installedVersions.map((versionRecord) => ({
        version: versionRecord.version,
        installDirectory: versionRecord.installDirectory,
        sourceKind: versionRecord.sourceKind,
        sourceRef: versionRecord.sourceRef,
        installedAt: versionRecord.installedAt,
        permissions: versionRecord.permissions,
      })),
      grants: appRecord.grants,
    };
  };

  resolveLaunch = async (
    appReference: string,
    explicitDocumentGrantMap: AppDocumentGrantMap,
  ): Promise<AppLaunchResolution> => {
    const sourceType = await this.detectSourceType(appReference, false);
    if (sourceType === "directory") {
      return {
        appDirectory: path.resolve(appReference),
        documentGrantMap: explicitDocumentGrantMap,
      };
    }
    const appRecord = await this.registryService.getApp(appReference);
    if (!appRecord) {
      throw new Error(`未找到应用目录，也未找到已安装应用：${appReference}`);
    }
    const activeVersion = appRecord.installedVersions[appRecord.activeVersion];
    if (!activeVersion) {
      throw new Error(`已安装应用缺少激活版本：${appReference}`);
    }
    return {
      appDirectory: activeVersion.installDirectory,
      appId: appRecord.appId,
      documentGrantMap: {
        ...appRecord.grants,
        ...explicitDocumentGrantMap,
      },
    };
  };

  persistGrants = async (
    appId: string | undefined,
    documentGrantMap: AppDocumentGrantMap,
  ): Promise<void> => {
    if (!appId || Object.keys(documentGrantMap).length === 0) {
      return;
    }
    await this.registryService.updateGrants(appId, documentGrantMap);
  };

  private detectSourceType = async (
    sourcePath: string,
    allowBundle: boolean = true,
  ): Promise<"directory" | "bundle" | "missing"> => {
    try {
      await access(sourcePath);
      const manifestBundle = await this.manifestService.load(sourcePath);
      if (manifestBundle.appDirectory) {
        return "directory";
      }
    } catch {
      if (allowBundle && sourcePath.endsWith(".napp")) {
        return "bundle";
      }
      return "missing";
    }
    return "missing";
  };
}
