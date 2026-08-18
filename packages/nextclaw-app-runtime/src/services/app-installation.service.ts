import { AsyncLocalStorage } from "node:async_hooks";
import { rm } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { isAppComponentManifestBundle } from "#app-runtime/types/app-manifest.types.js";
import type { AppManifestBundle } from "#app-runtime/types/app-manifest.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import { AppInstallationIntegrityService } from "#app-runtime/services/app-installation-integrity.service.js";
import { AppInstallationFilesystemService } from "#app-runtime/services/app-installation-filesystem.service.js";
import { AppInstallationLifecycleService } from "#app-runtime/services/app-installation-lifecycle.service.js";
import { FileLockService } from "#app-runtime/services/file-lock.service.js";
import { AppBuildService } from "#app-runtime/services/app-build.service.js";
import type { AppBundleExtractResult } from "#app-runtime/types/app-bundle.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import type { AppPublisher } from "#app-runtime/types/app-remote-registry.types.js";
import type { AppRegistryInstalledVersion } from "#app-runtime/types/app-registry.types.js";
import { AppRegistryConfigService } from "#app-runtime/services/app-registry-config.service.js";
import { AppRemoteRegistryClientService } from "#app-runtime/services/app-remote-registry-client.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";
import {
  AppInstallSourceService,
  type ResolvedAppInstallSource,
} from "#app-runtime/services/app-install-source.service.js";
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

const SAFE_APP_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

type AppInstallOptions = {
  registryUrl?: string;
  onProgress?: AppInstallProgressHandler;
  activate?: boolean;
  trustedPublisher?: AppPublisher;
};

type PreparedAppInstall = {
  source: ResolvedAppInstallSource;
  extractedDirectory: string;
  extractedMetadata: AppBundleExtractResult;
  manifestBundle: AppManifestBundle;
  options: AppInstallOptions;
};

type RemoteSourceFields = Pick<AppRegistryInstalledVersion, "registryUrl" | "bundleUrl" | "sha256" | "target">;

export class AppInstallationService {
  private readonly installSourceService: AppInstallSourceService;
  private readonly instanceStorageService: AppInstanceStorageService;
  private readonly fileLockService = new FileLockService();
  private readonly integrityService: AppInstallationIntegrityService;
  private readonly filesystemService: AppInstallationFilesystemService;
  private readonly lifecycleService: AppInstallationLifecycleService;
  private readonly appOperationContext = new AsyncLocalStorage<ReadonlySet<string>>();

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
    instanceStorageService?: AppInstanceStorageService,
  ) {
    this.installSourceService = new AppInstallSourceService(
      this.manifestService,
      this.remoteRegistryClient,
      this.bundleService,
    );
    this.instanceStorageService = instanceStorageService ?? new AppInstanceStorageService(appHomeService);
    this.integrityService = new AppInstallationIntegrityService(manifestService);
    this.filesystemService = new AppInstallationFilesystemService({
      buildService,
      integrityService: this.integrityService,
      manifestService,
    });
    this.lifecycleService = new AppInstallationLifecycleService({
      registryService,
      registryConfigService,
      remoteRegistryClient,
      instanceStorageService: this.instanceStorageService,
      integrityService: this.integrityService,
      install: this.install,
      rollback: this.rollback,
    });
  }

  install = async (
    appSource: string,
    options: AppInstallOptions = {},
  ): Promise<AppInstallResult> => {
    const { onProgress, registryUrl } = options;
    await onProgress?.("resolving");
    const source = await this.installSourceService.resolve(appSource, registryUrl);
    const tempDirectory = await this.appHomeService.createTemporaryDirectory("napp-install-");
    try {
      const bundlePath = await this.installSourceService.materializeBundle(
        source,
        tempDirectory,
        onProgress,
      );
      await onProgress?.("verifying");
      const extractedDirectory = path.join(tempDirectory, "bundle");
      const extractedMetadata = await this.bundleService.extractBundle({
        bundlePath,
        targetDirectory: extractedDirectory,
      });
      await this.filesystemService.materializeDistribution({
        appDirectory: extractedDirectory,
        distributionMode: extractedMetadata.metadata.distributionMode,
      });
      const manifestBundle = await this.manifestService.load(extractedDirectory);
      return await this.installPreparedBundle({
        source,
        extractedDirectory,
        extractedMetadata,
        manifestBundle,
        options,
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  };

  private installPreparedBundle = async (
    prepared: PreparedAppInstall,
  ): Promise<AppInstallResult> => {
    const appId = prepared.manifestBundle.manifest.id;
    return await this.withAppOperation(
      appId,
      async () => await this.commitPreparedInstall(prepared),
    );
  };

  private commitPreparedInstall = async (
    prepared: PreparedAppInstall,
  ): Promise<AppInstallResult> => {
    const { extractedDirectory, extractedMetadata, manifestBundle, options, source } = prepared;
    const { onProgress } = options;
    const { id: appId, version } = manifestBundle.manifest;
    const installDirectory = this.appHomeService.getInstallDirectory(appId, version);
    if (source.kind === "registry" && appId !== source.registryResolution.appId) {
      throw new Error(
        `bundle manifest.appId 与 registry 请求不一致：期望 ${source.registryResolution.appId}，实际 ${appId}`,
      );
    }
    await onProgress?.("installing");
    const existingRecord = await this.registryService.getApp(appId);
    const publisher = source.kind === "registry"
      ? source.registryResolution.publisher
      : options.trustedPublisher;
    const currentPublisher = existingRecord?.publisher ??
      existingRecord?.installedVersions[existingRecord.activeVersion]?.publisher;
    if (currentPublisher && currentPublisher.id !== publisher?.id) {
      throw new Error(
        `应用 ${appId} 已绑定发布者 ${currentPublisher.id}，拒绝由 ${publisher?.id ?? "未验证本地来源"} 覆盖。`,
      );
    }
    const dataSchemaVersion = manifestBundle.manifest.schemaVersion === 2
      ? manifestBundle.manifest.storage?.schemaVersion ?? 1
      : 1;
    if (existingRecord?.defaultInstance.dataSchemaVersion !== undefined &&
      existingRecord.defaultInstance.dataSchemaVersion !== dataSchemaVersion) {
      throw new Error(
        `应用 ${appId} 数据 schema 从 ${existingRecord.defaultInstance.dataSchemaVersion} 升级到 ${dataSchemaVersion}，但包内没有受支持的迁移合同。更新已停止，现有数据和版本保持不变。`,
      );
    }
    const instanceDirectory = this.appHomeService.getAppInstanceDirectory(appId, "default");
    const instanceExisted = await this.integrityService.pathExists(instanceDirectory);
    const contentSha256 = await this.filesystemService.copyToImmutableInstallDirectory({
      appId,
      appVersion: version,
      extractedDirectory,
      installDirectory,
      target: extractedMetadata.metadata.target?.kind === "native" ? extractedMetadata.metadata.target : undefined,
    });
    const defaultInstance = await this.instanceStorageService.materializeDefaultInstance({
      appId,
      publisherId: (currentPublisher ?? publisher)?.id,
      legacyDataDirectory: existingRecord?.defaultInstance.storage.layout === "legacy"
        ? existingRecord.dataDirectory
        : undefined,
      dataSchemaVersion,
    });
    await onProgress?.("finalizing");
    let registryRecord;
    try {
      registryRecord = await this.registryService.upsertInstallation({
        appId,
        name: manifestBundle.manifest.name,
        description: manifestBundle.manifest.description,
        version,
        installDirectory,
        defaultInstance,
        sourceKind: source.kind,
        distributionMode: source.kind === "registry"
          ? source.registryResolution.distributionMode
          : extractedMetadata.metadata.distributionMode,
        sourceRef: source.sourceRef,
        installedAt: new Date().toISOString(),
        permissions: manifestBundle.manifest.schemaVersion === 1
          ? manifestBundle.manifest.permissions ?? {}
          : this.manifestService.resolvePlatformSecurity(manifestBundle.manifest).permissions,
        ...this.readRemoteSourceFields(source.kind === "registry" ? source.registryResolution : undefined),
        publisher,
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
        security: isAppComponentManifestBundle(manifestBundle)
          ? this.manifestService.resolvePlatformSecurity(manifestBundle.manifest)
          : undefined,
        dataSchemaVersion,
        contentSha256,
        activate: options.activate,
      });
    } catch (error) {
      await this.integrityService.removeDirectory(installDirectory);
      if (!instanceExisted) {
        await this.instanceStorageService.rollbackNewInstance({
          instance: defaultInstance,
          legacyDataDirectory: existingRecord?.defaultInstance.storage.layout === "legacy"
            ? existingRecord.dataDirectory
            : undefined,
        });
      }
      throw error;
    }
    const installedVersion = registryRecord.installedVersions[version];
    return {
      appId: registryRecord.appId,
      name: registryRecord.name,
      version,
      installDirectory,
      dataDirectory: defaultInstance.storage.dataDirectory,
      instance: registryRecord.defaultInstance,
      sourceKind: source.kind,
      sourceRef: source.sourceRef,
      distributionMode: installedVersion?.distributionMode,
      permissions: installedVersion?.permissions ?? {},
      ...this.readRemoteSourceFields(installedVersion),
      publisher: installedVersion?.publisher,
      enabled: registryRecord.enabled,
      manifestSchemaVersion: installedVersion?.manifestSchemaVersion ?? 1,
      components: installedVersion?.components,
      primaryPanelId: installedVersion?.primaryPanelId,
    };
  };

  update = async (
    appId: string,
    options?: {
      version?: string;
      registryUrl?: string;
      onProgress?: AppInstallProgressHandler;
      activate?: boolean;
    },
  ): Promise<AppUpdateResult> => {
    return await this.withAppOperation(
      appId,
      async () => await this.lifecycleService.update(appId, options),
    );
  };

  uninstall = async (
    appId: string,
    purgeData: boolean,
  ): Promise<AppUninstallResult> => {
    return await this.withAppOperation(
      appId,
      async () => await this.lifecycleService.uninstall(appId, purgeData),
    );
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
    let appRecords = await this.registryService.listApps();
    for (const appRecord of appRecords) {
      await this.withAppOperation(appRecord.appId, async () => {
        for (const versionRecord of Object.values(appRecord.installedVersions)) {
          if (!await this.integrityService.pathExists(versionRecord.installDirectory)) {
            continue;
          }
          if (!versionRecord.contentSha256) {
            const contentSha256 = await this.integrityService.calculateDigest(
              versionRecord.installDirectory,
            );
            await this.registryService.setVersionContentDigest(
              appRecord.appId,
              versionRecord.version,
              contentSha256,
            );
          }
          await this.integrityService.protectDirectory(versionRecord.installDirectory);
        }
      });
    }
    appRecords = await this.registryService.listApps();
    const referencedInstallPaths = new Set(appRecords.flatMap((record) =>
      Object.values(record.installedVersions).map((version) => path.resolve(version.installDirectory))));
    const referencedDataPaths = new Set(appRecords.map((record) => path.resolve(
      record.defaultInstance.storage.layout === "instance-v1"
        ? record.defaultInstance.storage.instanceDirectory
        : record.dataDirectory,
    )));

    const packageDirectories = await this.filesystemService.readDirectories(
      this.appHomeService.getPackagesDirectory(),
    );
    for (const appDirectory of packageDirectories) {
      await this.filesystemService.reconcileGeneratedSiblings(appDirectory, referencedInstallPaths);
    }
    await this.filesystemService.reconcileGeneratedSiblings(
      this.appHomeService.getDataDirectory(),
      referencedDataPaths,
    );
    for (const appRecord of appRecords) {
      if (appRecord.defaultInstance.storage.layout !== "instance-v1") {
        continue;
      }
      await this.filesystemService.reconcileGeneratedSiblings(
        appRecord.defaultInstance.storage.instanceDirectory,
        new Set([path.resolve(appRecord.defaultInstance.storage.dataDirectory)]),
      );
    }
    for (const appRecord of appRecords) {
      if (appRecord.defaultInstance.storage.layout !== "legacy") {
        continue;
      }
      await this.withAppOperation(appRecord.appId, async () => {
        const currentRecord = await this.registryService.getApp(appRecord.appId);
        if (!currentRecord || currentRecord.defaultInstance.storage.layout !== "legacy") {
          return;
        }
        const activeVersion = currentRecord.installedVersions[currentRecord.activeVersion];
        if (!activeVersion) {
          throw new Error(`已安装应用缺少激活版本：${currentRecord.appId}`);
        }
        const instance = await this.instanceStorageService.materializeDefaultInstance({
          appId: currentRecord.appId,
          publisherId: currentRecord.publisher?.id,
          legacyDataDirectory: currentRecord.dataDirectory,
          dataSchemaVersion: currentRecord.defaultInstance.dataSchemaVersion,
        });
        try {
          await this.registryService.upsertInstallation({
            appId: currentRecord.appId,
            name: currentRecord.name,
            description: currentRecord.description,
            version: currentRecord.activeVersion,
            installDirectory: activeVersion.installDirectory,
            defaultInstance: instance,
            sourceKind: activeVersion.sourceKind,
            sourceRef: activeVersion.sourceRef,
            installedAt: activeVersion.installedAt,
            distributionMode: activeVersion.distributionMode,
            permissions: activeVersion.permissions,
            ...this.readRemoteSourceFields(activeVersion),
            publisher: currentRecord.publisher ?? activeVersion.publisher,
            manifestSchemaVersion: activeVersion.manifestSchemaVersion,
            components: activeVersion.components,
            primaryPanelId: activeVersion.primaryPanelId,
            security: activeVersion.security,
            dataSchemaVersion: activeVersion.dataSchemaVersion,
            contentSha256: activeVersion.contentSha256,
            enabled: currentRecord.enabled,
          });
        } catch (error) {
          await this.instanceStorageService.rollbackNewInstance({
            instance,
            legacyDataDirectory: currentRecord.dataDirectory,
          });
          throw error;
        }
      });
    }
  };

  info = async (
    appId: string,
    options: { measureStorageUsage?: boolean } = {},
  ): Promise<AppInfoResult> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const installedVersions = Object.values(appRecord.installedVersions).sort((left, right) =>
      left.version.localeCompare(right.version),
    );
    const storageUsage = options.measureStorageUsage === false
      ? undefined
      : await this.instanceStorageService.measureUsage(appRecord.defaultInstance.storage);
    return {
      appId: appRecord.appId,
      name: appRecord.name,
      description: appRecord.description,
      activeVersion: appRecord.activeVersion,
      enabled: appRecord.enabled,
      dataDirectory: appRecord.dataDirectory,
      instance: appRecord.defaultInstance,
      storage: appRecord.defaultInstance.storage,
      storageUsage,
      installedVersions: installedVersions.map((versionRecord) => ({
        version: versionRecord.version,
        installDirectory: versionRecord.installDirectory,
        sourceKind: versionRecord.sourceKind,
        distributionMode: versionRecord.distributionMode,
        sourceRef: versionRecord.sourceRef,
        installedAt: versionRecord.installedAt,
        permissions: versionRecord.permissions,
        ...this.readRemoteSourceFields(versionRecord),
        publisher: versionRecord.publisher,
        manifestSchemaVersion: versionRecord.manifestSchemaVersion,
        components: versionRecord.components,
        primaryPanelId: versionRecord.primaryPanelId,
        contentSha256: versionRecord.contentSha256,
      })),
      grants: appRecord.grants,
    };
  };

  setEnabled = async (appId: string, enabled: boolean): Promise<AppActivationResult> => {
    return await this.withAppOperation(appId, async () => {
      const appRecord = await this.registryService.setEnabled(appId, enabled);
      return {
        appId: appRecord.appId,
        activeVersion: appRecord.activeVersion,
        enabled: appRecord.enabled,
      };
    });
  };

  rollback = async (appId: string, version: string): Promise<AppRollbackResult> => {
    return await this.withAppOperation(appId, async () => {
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
    if (targetVersion.dataSchemaVersion !== currentRecord.defaultInstance.dataSchemaVersion) {
      throw new Error(
        `应用 ${appId}@${version} 需要数据 schema ${targetVersion.dataSchemaVersion}，当前实例为 ${currentRecord.defaultInstance.dataSchemaVersion}。没有可用 checkpoint，已阻止回滚。`,
      );
    }
    await this.assertVersionIntegrity(appId, version);
    const appRecord = await this.registryService.activateVersion(appId, version);
    return {
      appId,
      activeVersion: appRecord.activeVersion,
      previousVersion: currentRecord.activeVersion,
      enabled: appRecord.enabled,
      rolledBack: true,
    };
    });
  };

  assertVersionIntegrity = async (appId: string, version?: string): Promise<void> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const targetVersion = version ?? appRecord.activeVersion;
    const versionRecord = appRecord.installedVersions[targetVersion];
    if (!versionRecord) {
      throw new Error(`应用 ${appId} 未安装版本 ${targetVersion}。`);
    }
    const contentSha256 = await this.integrityService.assertVersion({
      appId,
      version: targetVersion,
      versionRecord,
    });
    if (!versionRecord.contentSha256) {
      await this.registryService.setVersionContentDigest(appId, targetVersion, contentSha256);
      await this.integrityService.protectDirectory(versionRecord.installDirectory);
    }
  };

  withAppOperation = async <T>(appId: string, operation: () => Promise<T>): Promise<T> => {
    if (!SAFE_APP_ID_PATTERN.test(appId)) {
      throw new Error(`appId 不是安全的 App 操作标识：${appId}`);
    }
    const lockPath = path.resolve(this.appHomeService.getAppOperationLockPath(appId));
    const activeLocks = this.appOperationContext.getStore();
    if (activeLocks?.has(lockPath)) {
      return await operation();
    }
    return await this.fileLockService.withLock(lockPath, async () => {
      const nextLocks = new Set(activeLocks ?? []);
      nextLocks.add(lockPath);
      return await this.appOperationContext.run(nextLocks, operation);
    });
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
    await this.assertVersionIntegrity(appRecord.appId, appRecord.activeVersion);
    return {
      appDirectory: activeVersion.installDirectory,
      appId: appRecord.appId,
      dataDirectory: appRecord.dataDirectory,
      storage: appRecord.defaultInstance.storage,
      documentGrantMap: {
        ...appRecord.grants,
        ...explicitDocumentGrantMap,
      },
    };
  };

  private readRemoteSourceFields = (source?: RemoteSourceFields): RemoteSourceFields => ({
    registryUrl: source?.registryUrl,
    bundleUrl: source?.bundleUrl,
    sha256: source?.sha256,
    target: source?.target,
  });

  persistGrants = async (
    appId: string | undefined,
    documentGrantMap: AppDocumentGrantMap,
  ): Promise<void> => {
    if (!appId || Object.keys(documentGrantMap).length === 0) {
      return;
    }
    await this.registryService.updateGrants(appId, documentGrantMap);
  };

}
