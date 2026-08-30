import { randomUUID } from "node:crypto";
import { rename } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import type { AppInstallationIntegrityService } from "#app-runtime/services/app-installation-integrity.service.js";
import type { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import type { AppRegistryConfigService } from "#app-runtime/services/app-registry-config.service.js";
import type { AppRegistryService } from "#app-runtime/services/app-registry.service.js";
import type { AppRemoteRegistryClientService } from "#app-runtime/services/app-remote-registry-client.service.js";
import type {
  AppInstallProgressHandler,
  AppInstallResult,
  AppRollbackResult,
  AppUninstallResult,
  AppUpdateResult,
} from "#app-runtime/types/app-installation.types.js";

type AppUpdateOptions = {
  version?: string;
  registryUrl?: string;
  onProgress?: AppInstallProgressHandler;
  activate?: boolean;
};

const WINDOWS_RENAME_RETRY_DELAYS_MS = [25, 50, 100, 200, 400] as const;
const WINDOWS_TRANSIENT_RENAME_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

export async function renameAppLifecyclePath(
  originalPath: string,
  targetPath: string,
  options: {
    platform?: NodeJS.Platform;
    renamePath?: typeof rename;
    wait?: (milliseconds: number) => Promise<unknown>;
  } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const renamePath = options.renamePath ?? rename;
  const wait = options.wait ?? delay;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await renamePath(originalPath, targetPath);
      return;
    } catch (error) {
      const retryDelay = WINDOWS_RENAME_RETRY_DELAYS_MS[attempt];
      const code = error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (
        platform !== "win32" ||
        retryDelay === undefined ||
        !code ||
        !WINDOWS_TRANSIENT_RENAME_CODES.has(code)
      ) {
        throw error;
      }
      await wait(retryDelay);
    }
  }
}

export class AppInstallationLifecycleService {
  constructor(private readonly params: {
    registryService: AppRegistryService;
    registryConfigService: AppRegistryConfigService;
    remoteRegistryClient: AppRemoteRegistryClientService;
    instanceStorageService: AppInstanceStorageService;
    integrityService: AppInstallationIntegrityService;
    install: (source: string, options: AppUpdateOptions) => Promise<AppInstallResult>;
    rollback: (appId: string, version: string) => Promise<AppRollbackResult>;
  }) {}

  update = async (appId: string, options: AppUpdateOptions = {}): Promise<AppUpdateResult> => {
    const { onProgress, registryUrl: requestedRegistryUrl, version } = options;
    await onProgress?.("resolving");
    const appRecord = await this.params.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const activeVersionRecord = appRecord.installedVersions[appRecord.activeVersion];
    const registryUrl = requestedRegistryUrl ??
      activeVersionRecord?.registryUrl ??
      (await this.params.registryConfigService.getSnapshot()).currentUrl;
    const resolution = await this.params.remoteRegistryClient.resolve({
      appId,
      version,
      registryUrl,
    });
    if (resolution.version === appRecord.activeVersion) {
      if (!activeVersionRecord) {
        throw new Error(`已安装应用缺少激活版本：${appId}`);
      }
      return this.toUpdateResult(appRecord, activeVersionRecord, appRecord.activeVersion, false);
    }
    const installedTarget = appRecord.installedVersions[resolution.version];
    if (installedTarget) {
      await onProgress?.("verifying");
      await onProgress?.("installing");
      if (options.activate !== false) {
        await this.params.rollback(appId, resolution.version);
      }
      await onProgress?.("finalizing");
      return this.toUpdateResult(appRecord, installedTarget, resolution.version, true);
    }
    const installResult = await this.params.install(`${appId}@${resolution.version}`, {
      registryUrl,
      onProgress,
      activate: options.activate,
    });
    return {
      ...installResult,
      previousVersion: appRecord.activeVersion,
      updated: true,
    };
  };

  uninstall = async (appId: string, purgeData: boolean): Promise<AppUninstallResult> => {
    const appRecord = await this.params.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    if (!purgeData) {
      await this.params.instanceStorageService.materializeDefaultInstance({
        appId,
        publisherId: appRecord.publisher?.id,
        legacyDataDirectory: appRecord.defaultInstance.storage.layout === "legacy"
          ? appRecord.dataDirectory
          : undefined,
        dataSchemaVersion: appRecord.defaultInstance.dataSchemaVersion,
      });
    }
    const removedVersions = Object.keys(appRecord.installedVersions).sort((left, right) =>
      left.localeCompare(right));
    const stagedPaths: Array<{ originalPath: string; stagedPath: string }> = [];
    try {
      for (const versionRecord of Object.values(appRecord.installedVersions)) {
        await this.stagePath(versionRecord.installDirectory, stagedPaths);
      }
      if (purgeData) {
        await this.stagePath(
          appRecord.defaultInstance.storage.layout === "instance-v1"
            ? appRecord.defaultInstance.storage.instanceDirectory
            : appRecord.dataDirectory,
          stagedPaths,
        );
      }
      if (!await this.params.registryService.removeApp(appId)) {
        throw new Error(`卸载过程中应用记录已发生变化：${appId}`);
      }
    } catch (error) {
      await this.restoreOrThrow(appId, stagedPaths, error);
      throw error;
    }
    await Promise.all(stagedPaths.map(async (entry) =>
      await this.params.integrityService.removeDirectory(entry.stagedPath)));
    return { appId, removedVersions, dataRemoved: purgeData };
  };

  private toUpdateResult = (
    appRecord: NonNullable<Awaited<ReturnType<AppRegistryService["getApp"]>>>,
    versionRecord: NonNullable<Awaited<ReturnType<AppRegistryService["getApp"]>>>["installedVersions"][string],
    version: string,
    updated: boolean,
  ): AppUpdateResult => ({
    appId: appRecord.appId,
    name: appRecord.name,
    version,
    previousVersion: appRecord.activeVersion,
    installDirectory: versionRecord.installDirectory,
    dataDirectory: appRecord.dataDirectory,
    instance: appRecord.defaultInstance,
    sourceKind: versionRecord.sourceKind,
    distributionMode: versionRecord.distributionMode,
    sourceRef: versionRecord.sourceRef,
    permissions: versionRecord.permissions,
    registryUrl: versionRecord.registryUrl,
    bundleUrl: versionRecord.bundleUrl,
    sha256: versionRecord.sha256,
    target: versionRecord.target,
    publisher: versionRecord.publisher,
    enabled: appRecord.enabled,
    manifestSchemaVersion: versionRecord.manifestSchemaVersion,
    components: versionRecord.components,
    primaryPanelId: versionRecord.primaryPanelId,
    updated,
  });

  private stagePath = async (
    originalPath: string,
    stagedPaths: Array<{ originalPath: string; stagedPath: string }>,
  ): Promise<void> => {
    if (!await this.params.integrityService.pathExists(originalPath)) {
      return;
    }
    const stagedPath = `${originalPath}.uninstalling-${randomUUID()}`;
    await renameAppLifecyclePath(originalPath, stagedPath);
    stagedPaths.push({ originalPath, stagedPath });
  };

  private restoreOrThrow = async (
    appId: string,
    stagedPaths: Array<{ originalPath: string; stagedPath: string }>,
    operationError: unknown,
  ): Promise<void> => {
    try {
      for (const entry of [...stagedPaths].reverse()) {
        if (await this.params.integrityService.pathExists(entry.stagedPath)) {
          await renameAppLifecyclePath(entry.stagedPath, entry.originalPath);
        }
      }
    } catch (restoreError) {
      throw new AggregateError(
        [operationError, restoreError],
        `卸载 ${appId} 失败，且无法完全恢复已暂存文件。`,
      );
    }
  };
}
