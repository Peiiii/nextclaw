import { randomUUID } from "node:crypto";
import { access, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import {
  isAppComponentManifestBundle,
  isAppStandaloneManifestBundle,
} from "#app-runtime/types/app-manifest.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppBuildService } from "#app-runtime/services/app-build.service.js";
import type { AppDistributionMode } from "#app-runtime/types/app-bundle.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import { AppRegistryConfigService } from "#app-runtime/services/app-registry-config.service.js";
import { AppRemoteRegistryClientService } from "#app-runtime/services/app-remote-registry-client.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";
import { AppInstallSourceService } from "#app-runtime/services/app-install-source.service.js";
import type {
  AppInfoResult,
  AppInstallProgressHandler,
  AppActivationResult,
  AppInstallResult,
  AppLaunchResolution,
  AppUpdateResult,
  AppRollbackResult,
  AppUninstallResult,
  InstalledAppListItem,
} from "#app-runtime/types/app-installation.types.js";

export class AppInstallationService {
  private readonly installSourceService: AppInstallSourceService;

  constructor(
    private readonly appHomeService: AppHomeService = new AppHomeService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly buildService: AppBuildService = new AppBuildService(),
    private readonly registryService: AppRegistryService = new AppRegistryService(appHomeService),
    private readonly registryConfigService: AppRegistryConfigService = new AppRegistryConfigService(
      appHomeService,
    ),
    private readonly remoteRegistryClient: AppRemoteRegistryClientService = new AppRemoteRegistryClientService(
      new AppRegistryConfigService(appHomeService),
    ),
  ) {
    this.installSourceService = new AppInstallSourceService(
      this.manifestService,
      this.remoteRegistryClient,
    );
  }

  install = async (
    appSource: string,
    options?: {
      registryUrl?: string;
      onProgress?: AppInstallProgressHandler;
    },
  ): Promise<AppInstallResult> => {
    const { onProgress, registryUrl } = options ?? {};
    await onProgress?.("resolving");
    const source = await this.installSourceService.resolve(appSource, registryUrl);
    const tempDirectory = await this.appHomeService.createTemporaryDirectory("napp-install-");
    try {
      if (source.kind === "registry") {
        await onProgress?.("downloading");
      }
      const bundlePath =
        source.kind === "directory"
          ? (await this.bundleService.packAppDirectory({
              appDirectory: source.appDirectory,
              outputPath: path.join(tempDirectory, "app.napp"),
            })).bundlePath
          : source.kind === "bundle"
            ? source.bundlePath
            : (
                await this.remoteRegistryClient.downloadBundle({
                  resolution: source.registryResolution,
                  targetDirectory: tempDirectory,
                })
              ).bundlePath;
      await onProgress?.("verifying");
      const extractedDirectory = path.join(tempDirectory, "bundle");
      const extractedMetadata = await this.bundleService.extractBundle({
        bundlePath,
        targetDirectory: extractedDirectory,
      });
      await this.materializeDistribution({
        appDirectory: extractedDirectory,
        distributionMode: extractedMetadata.metadata.distributionMode,
      });
      const manifestBundle = await this.manifestService.load(extractedDirectory);
      const installDirectory = this.appHomeService.getInstallDirectory(
        manifestBundle.manifest.id,
        manifestBundle.manifest.version,
      );
      if (
        source.kind === "registry" &&
        manifestBundle.manifest.id !== source.registryResolution.appId
      ) {
        throw new Error(
          `bundle manifest.appId 与 registry 请求不一致：期望 ${source.registryResolution.appId}，实际 ${manifestBundle.manifest.id}`,
        );
      }
      await onProgress?.("installing");
      const dataDirectory = this.appHomeService.getAppDataDirectory(manifestBundle.manifest.id);
      await this.copyToImmutableInstallDirectory({
        appId: manifestBundle.manifest.id,
        appVersion: manifestBundle.manifest.version,
        extractedDirectory,
        installDirectory,
      });
      await mkdir(dataDirectory, { recursive: true });
      await onProgress?.("finalizing");
      let registryRecord;
      try {
        registryRecord = await this.registryService.upsertInstallation({
          appId: manifestBundle.manifest.id,
          name: manifestBundle.manifest.name,
          description: manifestBundle.manifest.description,
          version: manifestBundle.manifest.version,
          installDirectory,
          dataDirectory,
          sourceKind: source.kind,
          distributionMode:
            source.kind === "registry"
              ? source.registryResolution.distributionMode
              : extractedMetadata.metadata.distributionMode,
          sourceRef: source.sourceRef,
          installedAt: new Date().toISOString(),
          permissions: manifestBundle.manifest.schemaVersion === 1
            ? manifestBundle.manifest.permissions ?? {}
            : {},
          registryUrl:
            source.kind === "registry" ? source.registryResolution.registryUrl : undefined,
          bundleUrl:
            source.kind === "registry" ? source.registryResolution.bundleUrl : undefined,
          sha256: source.kind === "registry" ? source.registryResolution.sha256 : undefined,
          publisher:
            source.kind === "registry" ? source.registryResolution.publisher : undefined,
          manifestSchemaVersion: manifestBundle.manifest.schemaVersion,
          components: isAppComponentManifestBundle(manifestBundle)
            ? manifestBundle.components.map((component) => ({
                ...component,
                componentDirectory: path.join(installDirectory, component.path),
                manifestPath: path.join(
                  installDirectory,
                  component.path,
                  component.kind === "panel" ? "panel-app.json" : "service-app.json",
                ),
              }))
            : undefined,
          primaryPanelId: isAppComponentManifestBundle(manifestBundle)
            ? manifestBundle.primaryPanelId
            : undefined,
        });
      } catch (error) {
        await rm(installDirectory, { recursive: true, force: true });
        throw error;
      }
      const activeVersionRecord = registryRecord.installedVersions[registryRecord.activeVersion];
      return {
        appId: registryRecord.appId,
        name: registryRecord.name,
        version: registryRecord.activeVersion,
        installDirectory,
        dataDirectory,
        sourceKind: source.kind,
        sourceRef: source.sourceRef,
        distributionMode:
          registryRecord.installedVersions[registryRecord.activeVersion]?.distributionMode,
        permissions:
          registryRecord.installedVersions[registryRecord.activeVersion]?.permissions ?? {},
        registryUrl:
          registryRecord.installedVersions[registryRecord.activeVersion]?.registryUrl,
        bundleUrl:
          registryRecord.installedVersions[registryRecord.activeVersion]?.bundleUrl,
        sha256: registryRecord.installedVersions[registryRecord.activeVersion]?.sha256,
        publisher:
          registryRecord.installedVersions[registryRecord.activeVersion]?.publisher,
        enabled: registryRecord.enabled,
        manifestSchemaVersion: activeVersionRecord?.manifestSchemaVersion ?? 1,
        components: activeVersionRecord?.components,
        primaryPanelId: activeVersionRecord?.primaryPanelId,
      };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  update = async (
    appId: string,
    options?: {
      version?: string;
      registryUrl?: string;
      onProgress?: AppInstallProgressHandler;
    },
  ): Promise<AppUpdateResult> => {
    const { onProgress, registryUrl: requestedRegistryUrl, version } = options ?? {};
    await onProgress?.("resolving");
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const activeVersionRecord = appRecord.installedVersions[appRecord.activeVersion];
    const registryUrl =
      requestedRegistryUrl ??
      activeVersionRecord?.registryUrl ??
      (await this.registryConfigService.getSnapshot()).currentUrl;
    const resolution = await this.remoteRegistryClient.resolve({
      appId,
      version,
      registryUrl,
    });
    if (resolution.version === appRecord.activeVersion) {
      if (!activeVersionRecord) {
        throw new Error(`已安装应用缺少激活版本：${appId}`);
      }
      return {
        appId: appRecord.appId,
        name: appRecord.name,
        version: appRecord.activeVersion,
        previousVersion: appRecord.activeVersion,
        installDirectory: activeVersionRecord.installDirectory,
        dataDirectory: appRecord.dataDirectory,
        sourceKind: activeVersionRecord.sourceKind,
        sourceRef: activeVersionRecord.sourceRef,
        permissions: activeVersionRecord.permissions,
        registryUrl: activeVersionRecord.registryUrl,
        bundleUrl: activeVersionRecord.bundleUrl,
        sha256: activeVersionRecord.sha256,
        publisher: activeVersionRecord.publisher,
        enabled: appRecord.enabled,
        manifestSchemaVersion: activeVersionRecord.manifestSchemaVersion,
        components: activeVersionRecord.components,
        primaryPanelId: activeVersionRecord.primaryPanelId,
        updated: false,
      };
    }
    const installedTarget = appRecord.installedVersions[resolution.version];
    if (installedTarget) {
      await onProgress?.("verifying");
      await onProgress?.("installing");
      await this.rollback(appId, resolution.version);
      await onProgress?.("finalizing");
      return {
        appId: appRecord.appId,
        name: appRecord.name,
        version: resolution.version,
        previousVersion: appRecord.activeVersion,
        installDirectory: installedTarget.installDirectory,
        dataDirectory: appRecord.dataDirectory,
        sourceKind: installedTarget.sourceKind,
        distributionMode: installedTarget.distributionMode,
        sourceRef: installedTarget.sourceRef,
        permissions: installedTarget.permissions,
        registryUrl: installedTarget.registryUrl,
        bundleUrl: installedTarget.bundleUrl,
        sha256: installedTarget.sha256,
        publisher: installedTarget.publisher,
        enabled: appRecord.enabled,
        manifestSchemaVersion: installedTarget.manifestSchemaVersion,
        components: installedTarget.components,
        primaryPanelId: installedTarget.primaryPanelId,
        updated: true,
      };
    }
    const installResult = await this.install(`${appId}@${resolution.version}`, {
      registryUrl,
      onProgress,
    });
    return {
      ...installResult,
      previousVersion: appRecord.activeVersion,
      updated: true,
    };
  };

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppUninstallResult> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const removedVersions = Object.keys(appRecord.installedVersions).sort((left, right) =>
      left.localeCompare(right),
    );
    const stagedPaths: Array<{ originalPath: string; stagedPath: string }> = [];
    const stagePath = async (originalPath: string): Promise<void> => {
      if (!await this.pathExists(originalPath)) {
        return;
      }
      const stagedPath = `${originalPath}.uninstalling-${randomUUID()}`;
      await rename(originalPath, stagedPath);
      stagedPaths.push({ originalPath, stagedPath });
    };
    const restoreStagedPaths = async (): Promise<void> => {
      for (const entry of [...stagedPaths].reverse()) {
        if (await this.pathExists(entry.stagedPath)) {
          await rename(entry.stagedPath, entry.originalPath);
        }
      }
    };
    try {
      for (const versionRecord of Object.values(appRecord.installedVersions)) {
        await stagePath(versionRecord.installDirectory);
      }
      if (purgeData) {
        await stagePath(appRecord.dataDirectory);
      }
      const removedRecord = await this.registryService.removeApp(appId);
      if (!removedRecord) {
        throw new Error(`卸载过程中应用记录已发生变化：${appId}`);
      }
    } catch (error) {
      try {
        await restoreStagedPaths();
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `卸载 ${appId} 失败，且无法完全恢复已暂存文件。`,
        );
      }
      throw error;
    }
    await Promise.all(stagedPaths.map((entry) =>
      rm(entry.stagedPath, { recursive: true, force: true }),
    ));
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
      sourceKind:
        appRecord.installedVersions[appRecord.activeVersion]?.sourceKind ?? "directory",
      distributionMode:
        appRecord.installedVersions[appRecord.activeVersion]?.distributionMode,
      enabled: appRecord.enabled,
      manifestSchemaVersion:
        appRecord.installedVersions[appRecord.activeVersion]?.manifestSchemaVersion ?? 1,
      primaryPanelId:
        appRecord.installedVersions[appRecord.activeVersion]?.primaryPanelId,
    }));
  };

  reconcileFilesystem = async (): Promise<void> => {
    await this.appHomeService.ensureBaseDirectories();
    const appRecords = await this.registryService.listApps();
    const referencedInstallPaths = new Set(appRecords.flatMap((record) =>
      Object.values(record.installedVersions).map((version) => path.resolve(version.installDirectory))));
    const referencedDataPaths = new Set(appRecords.map((record) => path.resolve(record.dataDirectory)));

    const packageDirectories = await this.readDirectories(this.appHomeService.getPackagesDirectory());
    for (const appDirectory of packageDirectories) {
      await this.reconcileGeneratedSiblings(appDirectory, referencedInstallPaths);
    }
    await this.reconcileGeneratedSiblings(
      this.appHomeService.getDataDirectory(),
      referencedDataPaths,
    );
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
      enabled: appRecord.enabled,
      dataDirectory: appRecord.dataDirectory,
      installedVersions: installedVersions.map((versionRecord) => ({
        version: versionRecord.version,
        installDirectory: versionRecord.installDirectory,
        sourceKind: versionRecord.sourceKind,
        distributionMode: versionRecord.distributionMode,
        sourceRef: versionRecord.sourceRef,
        installedAt: versionRecord.installedAt,
        permissions: versionRecord.permissions,
        registryUrl: versionRecord.registryUrl,
        bundleUrl: versionRecord.bundleUrl,
        sha256: versionRecord.sha256,
        publisher: versionRecord.publisher,
        manifestSchemaVersion: versionRecord.manifestSchemaVersion,
        components: versionRecord.components,
        primaryPanelId: versionRecord.primaryPanelId,
      })),
      grants: appRecord.grants,
    };
  };

  setEnabled = async (appId: string, enabled: boolean): Promise<AppActivationResult> => {
    const appRecord = await this.registryService.setEnabled(appId, enabled);
    return {
      appId: appRecord.appId,
      activeVersion: appRecord.activeVersion,
      enabled: appRecord.enabled,
    };
  };

  rollback = async (appId: string, version: string): Promise<AppRollbackResult> => {
    const currentRecord = await this.registryService.getApp(appId);
    if (!currentRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    if (currentRecord.activeVersion === version) {
      return {
        appId,
        activeVersion: version,
        previousVersion: version,
        enabled: currentRecord.enabled,
        rolledBack: false,
      };
    }
    const targetVersion = currentRecord.installedVersions[version];
    if (!targetVersion) {
      throw new Error(`应用 ${appId} 未安装版本 ${version}。`);
    }
    const targetManifest = await this.manifestService.load(targetVersion.installDirectory);
    if (targetManifest.manifest.id !== appId || targetManifest.manifest.version !== version) {
      throw new Error(`回滚目标 ${appId}@${version} 校验失败。`);
    }
    const appRecord = await this.registryService.activateVersion(appId, version);
    return {
      appId,
      activeVersion: appRecord.activeVersion,
      previousVersion: currentRecord.activeVersion,
      enabled: appRecord.enabled,
      rolledBack: true,
    };
  };

  resolveLaunch = async (
    appReference: string,
    explicitDocumentGrantMap: AppDocumentGrantMap,
  ): Promise<AppLaunchResolution> => {
    const sourceType = await this.installSourceService.detectLocal(appReference, false);
    if (sourceType.kind === "directory") {
      return {
        appDirectory: sourceType.appDirectory,
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
      dataDirectory: appRecord.dataDirectory,
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

  private copyToImmutableInstallDirectory = async (params: {
    appId: string;
    appVersion: string;
    extractedDirectory: string;
    installDirectory: string;
  }): Promise<void> => {
    const { appId, appVersion, extractedDirectory, installDirectory } = params;
    if (await this.pathExists(installDirectory)) {
      throw new Error(`应用版本目录已存在，不能覆盖不可变版本：${appId}@${appVersion}`);
    }
    await mkdir(path.dirname(installDirectory), { recursive: true });
    const stagedInstallDirectory = `${installDirectory}.staging-${randomUUID()}`;
    try {
      await cp(extractedDirectory, stagedInstallDirectory, { recursive: true });
      const stagedManifest = await this.manifestService.load(stagedInstallDirectory);
      if (
        stagedManifest.manifest.id !== appId ||
        stagedManifest.manifest.version !== appVersion
      ) {
        throw new Error("staging manifest 与已验证 bundle 身份不一致。");
      }
      await rename(stagedInstallDirectory, installDirectory);
    } catch (error) {
      await rm(stagedInstallDirectory, { recursive: true, force: true });
      throw error;
    }
  };

  private materializeDistribution = async (params: {
    appDirectory: string;
    distributionMode: AppDistributionMode;
  }): Promise<void> => {
    if (params.distributionMode !== "source") {
      return;
    }
    const manifestBundle = await this.manifestService.load(params.appDirectory);
    if (!isAppStandaloneManifestBundle(manifestBundle)) {
      throw new Error("schema v2 组合包不允许运行安装期 build。");
    }
    if (manifestBundle.manifest.main.kind !== "wasi-http-component") {
      return;
    }
    await this.buildService.build({
      appDirectory: params.appDirectory,
      install: true,
    });
  };

  private reconcileGeneratedSiblings = async (
    parentDirectory: string,
    referencedPaths: Set<string>,
  ): Promise<void> => {
    for (const entry of await this.readDirectories(parentDirectory)) {
      const entryName = path.basename(entry);
      const stagingMarker = ".staging-";
      const uninstallingMarker = ".uninstalling-";
      if (entryName.includes(stagingMarker)) {
        await rm(entry, { recursive: true, force: true });
        continue;
      }
      const markerIndex = entryName.indexOf(uninstallingMarker);
      if (markerIndex < 0) {
        continue;
      }
      const originalPath = path.join(parentDirectory, entryName.slice(0, markerIndex));
      if (referencedPaths.has(path.resolve(originalPath)) && !await this.pathExists(originalPath)) {
        await rename(entry, originalPath);
      } else {
        await rm(entry, { recursive: true, force: true });
      }
    }
  };

  private readDirectories = async (directory: string): Promise<string[]> => {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(directory, entry.name));
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  };

  private pathExists = async (targetPath: string): Promise<boolean> => {
    try {
      await access(targetPath);
      return true;
    } catch {
      return false;
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
