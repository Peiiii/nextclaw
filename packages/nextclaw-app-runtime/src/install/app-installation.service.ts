import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { AppBundleService } from "../bundle/app-bundle.service.js";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppHomeService } from "../paths/app-home.service.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";
import { AppRegistryConfigService } from "../registry/app-registry-config.service.js";
import { AppRemoteRegistryClientService } from "../registry/app-remote-registry-client.service.js";
import { AppRegistryService } from "../registry/app-registry.service.js";
import type {
  AppInfoResult,
  AppInstallResult,
  AppLaunchResolution,
  AppUpdateResult,
  AppUninstallResult,
  InstalledAppListItem,
} from "./app-installation.types.js";

export class AppInstallationService {
  constructor(
    private readonly appHomeService: AppHomeService = new AppHomeService(),
    private readonly bundleService: AppBundleService = new AppBundleService(),
    private readonly manifestService: AppManifestService = new AppManifestService(),
    private readonly registryService: AppRegistryService = new AppRegistryService(appHomeService),
    private readonly registryConfigService: AppRegistryConfigService = new AppRegistryConfigService(
      appHomeService,
    ),
    private readonly remoteRegistryClient: AppRemoteRegistryClientService = new AppRemoteRegistryClientService(
      new AppRegistryConfigService(appHomeService),
    ),
  ) {}

  install = async (
    appSource: string,
    options?: {
      registryUrl?: string;
    },
  ): Promise<AppInstallResult> => {
    const source = await this.resolveInstallSource(appSource, options?.registryUrl);
    const tempDirectory = await this.appHomeService.createTemporaryDirectory("napp-install-");
    try {
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
      if (
        source.kind === "registry" &&
        manifestBundle.manifest.id !== source.registryResolution.appId
      ) {
        throw new Error(
          `bundle manifest.appId 与 registry 请求不一致：期望 ${source.registryResolution.appId}，实际 ${manifestBundle.manifest.id}`,
        );
      }
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
        sourceKind: source.kind,
        sourceRef: source.sourceRef,
        installedAt: new Date().toISOString(),
        permissions: manifestBundle.manifest.permissions ?? {},
        registryUrl:
          source.kind === "registry" ? source.registryResolution.registryUrl : undefined,
        bundleUrl:
          source.kind === "registry" ? source.registryResolution.bundleUrl : undefined,
        sha256: source.kind === "registry" ? source.registryResolution.sha256 : undefined,
        publisher:
          source.kind === "registry" ? source.registryResolution.publisher : undefined,
      });
      return {
        appId: registryRecord.appId,
        name: registryRecord.name,
        version: registryRecord.activeVersion,
        installDirectory,
        dataDirectory,
        sourceKind: source.kind,
        sourceRef: source.sourceRef,
        permissions:
          registryRecord.installedVersions[registryRecord.activeVersion]?.permissions ?? {},
        registryUrl:
          registryRecord.installedVersions[registryRecord.activeVersion]?.registryUrl,
        bundleUrl:
          registryRecord.installedVersions[registryRecord.activeVersion]?.bundleUrl,
        sha256: registryRecord.installedVersions[registryRecord.activeVersion]?.sha256,
        publisher:
          registryRecord.installedVersions[registryRecord.activeVersion]?.publisher,
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
    },
  ): Promise<AppUpdateResult> => {
    const appRecord = await this.registryService.getApp(appId);
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    const activeVersionRecord = appRecord.installedVersions[appRecord.activeVersion];
    const registryUrl =
      options?.registryUrl ??
      activeVersionRecord?.registryUrl ??
      (await this.registryConfigService.getSnapshot()).currentUrl;
    const resolution = await this.remoteRegistryClient.resolve({
      appId,
      version: options?.version,
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
        updated: false,
      };
    }
    const installResult = await this.install(`${appId}@${resolution.version}`, {
      registryUrl,
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
      sourceKind:
        appRecord.installedVersions[appRecord.activeVersion]?.sourceKind ?? "directory",
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
        registryUrl: versionRecord.registryUrl,
        bundleUrl: versionRecord.bundleUrl,
        sha256: versionRecord.sha256,
        publisher: versionRecord.publisher,
      })),
      grants: appRecord.grants,
    };
  };

  resolveLaunch = async (
    appReference: string,
    explicitDocumentGrantMap: AppDocumentGrantMap,
  ): Promise<AppLaunchResolution> => {
    const sourceType = await this.detectLocalSourceType(appReference, false);
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

  private resolveInstallSource = async (
    appSource: string,
    registryUrl?: string,
  ): Promise<
    | {
        kind: "directory";
        appDirectory: string;
        sourceRef: string;
      }
    | {
        kind: "bundle";
        bundlePath: string;
        sourceRef: string;
      }
    | {
        kind: "registry";
        sourceRef: string;
        registryResolution: Awaited<ReturnType<AppRemoteRegistryClientService["resolve"]>>;
      }
  > => {
    const localSource = await this.detectLocalSourceType(appSource);
    if (localSource.kind === "directory") {
      return {
        kind: "directory",
        appDirectory: localSource.appDirectory,
        sourceRef: localSource.appDirectory,
      };
    }
    if (localSource.kind === "bundle") {
      return {
        kind: "bundle",
        bundlePath: localSource.bundlePath,
        sourceRef: localSource.bundlePath,
      };
    }
    const registrySpec = this.parseRegistrySpec(appSource);
    if (!registrySpec) {
      if (this.looksLikePath(appSource)) {
        throw new Error(`本地安装源不存在：${appSource}`);
      }
      throw new Error(`无法识别安装源：${appSource}`);
    }
    const registryResolution = await this.remoteRegistryClient.resolve({
      appId: registrySpec.appId,
      version: registrySpec.version,
      registryUrl,
    });
    return {
      kind: "registry",
      sourceRef: `${registryResolution.appId}@${registryResolution.version}`,
      registryResolution,
    };
  };

  private detectLocalSourceType = async (
    sourcePath: string,
    allowBundle: boolean = true,
  ): Promise<
    | {
        kind: "directory";
        appDirectory: string;
      }
    | {
        kind: "bundle";
        bundlePath: string;
      }
    | {
        kind: "missing";
      }
  > => {
    const normalizedSource = path.resolve(sourcePath);
    try {
      await access(normalizedSource);
      const manifestBundle = await this.manifestService.load(normalizedSource);
      if (manifestBundle.appDirectory) {
        return {
          kind: "directory",
          appDirectory: normalizedSource,
        };
      }
    } catch {
      if (allowBundle && normalizedSource.endsWith(".napp")) {
        try {
          await access(normalizedSource);
          return {
            kind: "bundle",
            bundlePath: normalizedSource,
          };
        } catch {
          return {
            kind: "missing",
          };
        }
      }
      return {
        kind: "missing",
      };
    }
    return {
      kind: "missing",
    };
  };

  private parseRegistrySpec = (
    appSource: string,
  ): {
    appId: string;
    version?: string;
  } | undefined => {
    const match = /^(?<appId>[a-z0-9][a-z0-9._-]*)(?:@(?<version>[A-Za-z0-9._+-]+))?$/i.exec(
      appSource.trim(),
    );
    if (!match?.groups?.appId) {
      return undefined;
    }
    return {
      appId: match.groups.appId,
      version: match.groups.version,
    };
  };

  private looksLikePath = (appSource: string): boolean => {
    return (
      appSource.startsWith(".") ||
      appSource.startsWith("/") ||
      appSource.includes(path.sep)
    );
  };
}
