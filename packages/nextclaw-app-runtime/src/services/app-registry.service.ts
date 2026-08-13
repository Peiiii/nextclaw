import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type {
  AppPermissions,
  AppPlatformSecuritySummary,
  AppResolvedComponent,
} from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import { FileLockService } from "#app-runtime/services/file-lock.service.js";
import type { AppInstanceRecord } from "#app-runtime/types/app-storage.types.js";
import type {
  AppInstallSourceKind,
  AppRegistry,
  AppRegistryAppRecord,
  AppRegistryInstalledVersion,
} from "#app-runtime/types/app-registry.types.js";

const SAFE_APP_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SAFE_VERSION_PATTERN = /^[0-9A-Za-z]+(?:[._+-][0-9A-Za-z]+)*$/;
const SAFE_COMPONENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AppRegistryService {
  private readonly instanceStorageService: AppInstanceStorageService;
  private readonly fileLockService = new FileLockService();

  constructor(private readonly appHomeService: AppHomeService = new AppHomeService()) {
    this.instanceStorageService = new AppInstanceStorageService(appHomeService);
  }

  load = async (): Promise<AppRegistry> => {
    await this.appHomeService.ensureBaseDirectories();
    try {
      const raw = await readFile(this.appHomeService.getRegistryPath(), "utf-8");
      return this.parseRegistry(JSON.parse(raw) as unknown);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return { schemaVersion: 1, apps: {}, suppressedBuiltIns: {} };
      }
      throw error;
    }
  };

  save = async (registry: AppRegistry): Promise<void> => {
    await this.withMutation(async () => await this.saveUnlocked(registry));
  };

  private saveUnlocked = async (registry: AppRegistry): Promise<void> => {
    await this.appHomeService.ensureBaseDirectories();
    const registryPath = this.appHomeService.getRegistryPath();
    const temporaryPath = path.join(
      path.dirname(registryPath),
      `.${path.basename(registryPath)}.${process.pid}.${Date.now()}.tmp`,
    );
    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(registry, null, 2)}\n`, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, registryPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  };

  listApps = async (): Promise<AppRegistryAppRecord[]> => {
    const registry = await this.load();
    return Object.values(registry.apps).sort((left, right) => left.appId.localeCompare(right.appId));
  };

  getApp = async (appId: string): Promise<AppRegistryAppRecord | undefined> => {
    const registry = await this.load();
    return registry.apps[appId];
  };

  getActiveVersion = async (appId: string): Promise<AppRegistryInstalledVersion | undefined> => {
    const appRecord = await this.getApp(appId);
    return appRecord?.installedVersions[appRecord.activeVersion];
  };

  upsertInstallation = async (params: {
    appId: string;
    name: string;
    description?: string;
    version: string;
    installDirectory: string;
    defaultInstance: AppInstanceRecord;
    sourceKind: AppInstallSourceKind;
    sourceRef: string;
    installedAt: string;
    distributionMode?: AppRegistryInstalledVersion["distributionMode"];
    permissions: AppPermissions;
    registryUrl?: string;
    bundleUrl?: string;
    sha256?: string;
    publisher?: AppRegistryInstalledVersion["publisher"];
    manifestSchemaVersion: 1 | 2;
    components?: AppResolvedComponent[];
    primaryPanelId?: string;
    security?: AppPlatformSecuritySummary;
    dataSchemaVersion: number;
    contentSha256?: string;
    enabled?: boolean;
    activate?: boolean;
  }): Promise<AppRegistryAppRecord> => {
    return await this.withMutation(async () => {
      const registry = await this.load();
      const currentRecord = registry.apps[params.appId];
      const currentPublisher = currentRecord?.publisher ??
        currentRecord?.installedVersions[currentRecord.activeVersion]?.publisher;
      if (currentPublisher && currentPublisher.id !== params.publisher?.id) {
        throw new Error(
          `应用 ${params.appId} 已绑定发布者 ${currentPublisher.id}，拒绝由 ${params.publisher?.id ?? "未验证本地来源"} 覆盖。`,
        );
      }
      const nextRecord: AppRegistryAppRecord = {
        appId: params.appId,
        name: params.name,
        description: params.description,
        publisher: currentPublisher ?? params.publisher,
        activeVersion: params.activate === false && currentRecord
          ? currentRecord.activeVersion
          : params.version,
        enabled: params.enabled ?? currentRecord?.enabled ?? params.manifestSchemaVersion === 1,
        dataDirectory: params.defaultInstance.storage.dataDirectory,
        defaultInstance: params.defaultInstance,
        installedVersions: {
          ...(currentRecord?.installedVersions ?? {}),
          [params.version]: {
            version: params.version,
            installDirectory: params.installDirectory,
            sourceKind: params.sourceKind,
            sourceRef: params.sourceRef,
            installedAt: params.installedAt,
            distributionMode: params.distributionMode,
            permissions: params.permissions,
            registryUrl: params.registryUrl,
            bundleUrl: params.bundleUrl,
            sha256: params.sha256,
            publisher: params.publisher,
            manifestSchemaVersion: params.manifestSchemaVersion,
            components: params.components,
            primaryPanelId: params.primaryPanelId,
            security: params.security,
            dataSchemaVersion: params.dataSchemaVersion,
            contentSha256: params.contentSha256,
          },
        },
        grants: currentRecord?.grants ?? {},
      };
      registry.apps[params.appId] = nextRecord;
      await this.saveUnlocked(registry);
      return nextRecord;
    });
  };

  setEnabled = async (appId: string, enabled: boolean): Promise<AppRegistryAppRecord> => {
    return await this.updateApp(appId, (record) => ({ ...record, enabled }));
  };

  activateVersion = async (
    appId: string,
    version: string,
  ): Promise<AppRegistryAppRecord> => {
    return await this.updateApp(appId, (record) => {
      if (!record.installedVersions[version]) {
        throw new Error(`应用 ${appId} 未安装版本 ${version}。`);
      }
      return { ...record, activeVersion: version };
    });
  };

  setVersionContentDigest = async (
    appId: string,
    version: string,
    contentSha256: string,
  ): Promise<AppRegistryAppRecord> => {
    return await this.updateApp(appId, (record) => {
      const installedVersion = record.installedVersions[version];
      if (!installedVersion) {
        throw new Error(`应用 ${appId} 未安装版本 ${version}。`);
      }
      if (installedVersion.contentSha256 && installedVersion.contentSha256 !== contentSha256) {
        throw new Error(`应用 ${appId}@${version} 已存在不同的代码完整性摘要。`);
      }
      return {
        ...record,
        installedVersions: {
          ...record.installedVersions,
          [version]: { ...installedVersion, contentSha256 },
        },
      };
    });
  };

  updateGrants = async (
    appId: string,
    grants: AppDocumentGrantMap,
  ): Promise<AppRegistryAppRecord> => {
    return await this.updateApp(appId, (record) => ({
      ...record,
      grants: { ...record.grants, ...grants },
    }));
  };

  setDocumentGrant = async (
    appId: string,
    scopeId: string,
    directoryPath: string,
  ): Promise<AppRegistryAppRecord> => {
    return await this.updateGrants(appId, { [scopeId]: directoryPath });
  };

  removeDocumentGrant = async (appId: string, scopeId: string): Promise<boolean> => {
    let removed = false;
    await this.updateApp(appId, (record) => {
      if (!(scopeId in record.grants)) {
        return record;
      }
      const grants = { ...record.grants };
      delete grants[scopeId];
      removed = true;
      return { ...record, grants };
    });
    return removed;
  };

  removeApp = async (appId: string): Promise<AppRegistryAppRecord | undefined> => {
    return await this.withMutation(async () => {
      const registry = await this.load();
      const appRecord = registry.apps[appId];
      if (!appRecord) {
        return undefined;
      }
      delete registry.apps[appId];
      await this.saveUnlocked(registry);
      return appRecord;
    });
  };

  isBuiltInSuppressed = async (appId: string): Promise<boolean> => {
    const registry = await this.load();
    return Boolean(registry.suppressedBuiltIns[appId]);
  };

  setBuiltInSuppressed = async (appId: string, suppressed: boolean): Promise<void> => {
    await this.withMutation(async () => {
      const registry = await this.load();
      if (suppressed) {
        registry.suppressedBuiltIns[appId] = { suppressedAt: new Date().toISOString() };
      } else {
        delete registry.suppressedBuiltIns[appId];
      }
      await this.saveUnlocked(registry);
    });
  };

  private updateApp = async (
    appId: string,
    update: (record: AppRegistryAppRecord) => AppRegistryAppRecord,
  ): Promise<AppRegistryAppRecord> => {
    return await this.withMutation(async () => {
      const registry = await this.load();
      const appRecord = registry.apps[appId];
      if (!appRecord) {
        throw new Error(`未找到已安装应用：${appId}`);
      }
      const nextRecord = update(appRecord);
      registry.apps[appId] = nextRecord;
      await this.saveUnlocked(registry);
      return nextRecord;
    });
  };

  private withMutation = async <T>(operation: () => Promise<T>): Promise<T> => {
    const registryPath = path.resolve(this.appHomeService.getRegistryPath());
    return await this.fileLockService.withLock(`${registryPath}.lock`, operation);
  };

  private parseRegistry = (rawRegistry: unknown): AppRegistry => {
    const candidate = this.assertRecord(rawRegistry, "registry.json");
    if (candidate.schemaVersion !== 1) {
      throw new Error("当前只支持 registry schemaVersion = 1。");
    }
    const rawApps = this.assertRecord(candidate.apps, "registry.apps");
    const apps: Record<string, AppRegistryAppRecord> = {};
    for (const [appId, rawApp] of Object.entries(rawApps)) {
      if (!SAFE_APP_ID_PATTERN.test(appId)) {
        throw new Error(`registry.apps 包含不安全的 appId：${appId}`);
      }
      const app = this.assertRecord(rawApp, `registry.apps.${appId}`) as Partial<AppRegistryAppRecord>;
      const installedVersions: Record<string, AppRegistryInstalledVersion> = {};
      const rawVersions = this.assertRecord(
        app.installedVersions,
        `registry.apps.${appId}.installedVersions`,
      );
      for (const [version, rawVersion] of Object.entries(rawVersions)) {
        if (!SAFE_VERSION_PATTERN.test(version)) {
          throw new Error(`registry.apps.${appId} 包含不安全的版本：${version}`);
        }
        const versionRecord = this.assertRecord(
          rawVersion,
          `registry.apps.${appId}.installedVersions.${version}`,
        ) as Partial<AppRegistryInstalledVersion>;
        const installDirectory = this.requireString(
          versionRecord.installDirectory,
          `registry.apps.${appId}.installedVersions.${version}.installDirectory`,
        );
        this.assertExactPath(
          installDirectory,
          this.appHomeService.getInstallDirectory(appId, version),
          `registry.apps.${appId}.installedVersions.${version}.installDirectory`,
        );
        installedVersions[version] = {
          ...(versionRecord as AppRegistryInstalledVersion),
          version,
          installDirectory: path.resolve(installDirectory),
          manifestSchemaVersion: versionRecord.manifestSchemaVersion === 2 ? 2 : 1,
          components: this.parseComponents(
            versionRecord.components,
            installDirectory,
            `registry.apps.${appId}.installedVersions.${version}.components`,
          ),
          dataSchemaVersion: typeof versionRecord.dataSchemaVersion === "number" &&
            Number.isSafeInteger(versionRecord.dataSchemaVersion) &&
            versionRecord.dataSchemaVersion > 0
            ? versionRecord.dataSchemaVersion
            : 1,
        };
      }
      const activeVersion = this.requireString(app.activeVersion, `registry.apps.${appId}.activeVersion`);
      if (!installedVersions[activeVersion]) {
        throw new Error(`registry.apps.${appId} 缺少 activeVersion ${activeVersion}。`);
      }
      const dataDirectory = this.requireString(
        app.dataDirectory,
        `registry.apps.${appId}.dataDirectory`,
      );
      const firstInstalledAt = Object.values(installedVersions)
        .map((version) => version.installedAt)
        .filter((value): value is string => typeof value === "string")
        .sort()[0] ?? new Date(0).toISOString();
      const defaultInstance = this.parseDefaultInstance(
        app.defaultInstance,
        appId,
        dataDirectory,
        firstInstalledAt,
      );
      apps[appId] = {
        ...(app as AppRegistryAppRecord),
        appId,
        publisher: app.publisher ?? installedVersions[activeVersion]?.publisher,
        enabled: typeof app.enabled === "boolean" ? app.enabled : true,
        activeVersion,
        dataDirectory: defaultInstance.storage.dataDirectory,
        defaultInstance,
        installedVersions,
        grants: app.grants && typeof app.grants === "object" ? app.grants : {},
      };
    }
    const suppressedBuiltIns = candidate.suppressedBuiltIns &&
      typeof candidate.suppressedBuiltIns === "object" &&
      !Array.isArray(candidate.suppressedBuiltIns)
      ? Object.fromEntries(Object.entries(candidate.suppressedBuiltIns).flatMap(([appId, raw]) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return [];
          }
          const suppressedAt = (raw as { suppressedAt?: unknown }).suppressedAt;
          return typeof suppressedAt === "string" ? [[appId, { suppressedAt }]] : [];
        }))
      : {};
    return { schemaVersion: 1, apps, suppressedBuiltIns };
  };

  private parseDefaultInstance = (
    rawInstance: unknown,
    appId: string,
    dataDirectory: string,
    createdAt: string,
  ): AppInstanceRecord => {
    if (!rawInstance || typeof rawInstance !== "object" || Array.isArray(rawInstance)) {
      this.assertExactPath(
        dataDirectory,
        this.appHomeService.getAppDataDirectory(appId),
        `registry.apps.${appId}.dataDirectory`,
      );
      return this.instanceStorageService.buildLegacyDefaultInstance({
        appId,
        dataDirectory,
        createdAt,
      });
    }
    const instance = rawInstance as Partial<AppInstanceRecord>;
    if (
      instance.id !== "default" ||
      !instance.storage ||
      typeof instance.storage !== "object" ||
      (instance.storage.layout !== "legacy" && instance.storage.layout !== "instance-v1")
    ) {
      throw new Error(`registry.apps.${appId}.defaultInstance 无效。`);
    }
    if (instance.publisherId !== undefined && typeof instance.publisherId !== "string") {
      throw new Error(`registry.apps.${appId}.defaultInstance.publisherId 无效。`);
    }
    const dataSchemaVersion = typeof instance.dataSchemaVersion === "number" &&
      Number.isSafeInteger(instance.dataSchemaVersion) &&
      instance.dataSchemaVersion > 0
      ? instance.dataSchemaVersion
      : 1;
    const instanceCreatedAt = typeof instance.createdAt === "string"
      ? instance.createdAt
      : createdAt;
    const instanceDirectory = path.resolve(
      this.appHomeService.getAppInstanceDirectory(appId, "default"),
    );
    const expectedStorage = {
      layout: "instance-v1" as const,
      layoutVersion: 1 as const,
      instanceId: "default",
      instanceDirectory,
      dataDirectory: path.join(instanceDirectory, "data"),
      configDirectory: path.join(instanceDirectory, "config"),
      stateDirectory: path.join(instanceDirectory, "state"),
      cacheDirectory: path.join(instanceDirectory, "cache"),
      temporaryDirectory: path.join(instanceDirectory, "tmp"),
      logsDirectory: path.join(instanceDirectory, "logs"),
    };
    if (instance.storage.layout === "legacy") {
      const expectedLegacyDataDirectory = this.appHomeService.getAppDataDirectory(appId);
      this.assertExactPath(
        dataDirectory,
        expectedLegacyDataDirectory,
        `registry.apps.${appId}.dataDirectory`,
      );
      return {
        id: "default",
        publisherId: instance.publisherId,
        storage: {
          ...expectedStorage,
          layout: "legacy",
          dataDirectory: path.resolve(expectedLegacyDataDirectory),
        },
        dataSchemaVersion,
        createdAt: instanceCreatedAt,
        migratedAt: instance.migratedAt,
        legacyDataDirectory: path.resolve(expectedLegacyDataDirectory),
      };
    }
    for (const [field, expectedPath] of Object.entries({
      instanceDirectory: expectedStorage.instanceDirectory,
      dataDirectory: expectedStorage.dataDirectory,
      configDirectory: expectedStorage.configDirectory,
      stateDirectory: expectedStorage.stateDirectory,
      cacheDirectory: expectedStorage.cacheDirectory,
      temporaryDirectory: expectedStorage.temporaryDirectory,
      logsDirectory: expectedStorage.logsDirectory,
    })) {
      this.assertExactPath(
        instance.storage[field as keyof typeof instance.storage] as string,
        expectedPath,
        `registry.apps.${appId}.defaultInstance.storage.${field}`,
      );
    }
    this.assertExactPath(
      dataDirectory,
      expectedStorage.dataDirectory,
      `registry.apps.${appId}.dataDirectory`,
    );
    return {
      id: "default",
      publisherId: instance.publisherId,
      storage: expectedStorage,
      dataSchemaVersion,
      createdAt: instanceCreatedAt,
      migratedAt: instance.migratedAt,
      legacyDataDirectory: instance.legacyDataDirectory,
    };
  };

  private assertExactPath = (actual: unknown, expected: string, field: string): void => {
    if (typeof actual !== "string" || path.resolve(actual) !== path.resolve(expected)) {
      throw new Error(`${field} 必须位于受管路径 ${path.resolve(expected)}。`);
    }
  };

  private parseComponents = (
    rawComponents: unknown,
    installDirectory: string,
    field: string,
  ): AppResolvedComponent[] | undefined => {
    if (rawComponents === undefined) {
      return undefined;
    }
    if (!Array.isArray(rawComponents)) {
      throw new Error(`${field} 必须是数组。`);
    }
    return rawComponents.map((rawComponent, index) => {
      const component = this.assertRecord(rawComponent, `${field}[${index}]`);
      const kind = component.kind;
      if (kind !== "panel" && kind !== "service") {
        throw new Error(`${field}[${index}].kind 无效。`);
      }
      const id = this.requireString(component.id, `${field}[${index}].id`);
      if (!SAFE_COMPONENT_ID_PATTERN.test(id)) {
        throw new Error(`${field}[${index}].id 不安全。`);
      }
      const relativeComponentPath = this.requireString(
        component.path,
        `${field}[${index}].path`,
      );
      const expectedComponentDirectory = path.resolve(installDirectory, relativeComponentPath);
      const relativeToInstall = path.relative(
        path.resolve(installDirectory),
        expectedComponentDirectory,
      );
      if (
        !relativeToInstall ||
        relativeToInstall.startsWith("..") ||
        path.isAbsolute(relativeToInstall)
      ) {
        throw new Error(`${field}[${index}].path 必须位于版本目录内。`);
      }
      const expectedManifestPath = path.join(
        expectedComponentDirectory,
        kind === "panel" ? "panel-app.json" : "service-app.json",
      );
      this.assertExactPath(
        component.componentDirectory,
        expectedComponentDirectory,
        `${field}[${index}].componentDirectory`,
      );
      this.assertExactPath(
        component.manifestPath,
        expectedManifestPath,
        `${field}[${index}].manifestPath`,
      );
      return {
        kind,
        id,
        path: relativeComponentPath,
        componentDirectory: expectedComponentDirectory,
        manifestPath: expectedManifestPath,
      };
    });
  };

  private assertRecord = (value: unknown, field: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${field} 必须是对象。`);
    }
    return value as Record<string, unknown>;
  };

  private requireString = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${field} 必须是非空字符串。`);
    }
    return value;
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
