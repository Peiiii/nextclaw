import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type {
  AppPermissions,
  AppPlatformSecuritySummary,
  AppResolvedComponent,
} from "#app-runtime/types/app-manifest.types.js";
import type {
  AppDocumentGrantMap,
  AppStoredDocumentGrant,
} from "#app-runtime/types/app-permissions.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppRegistryParserService } from "#app-runtime/services/app-registry-parser.service.js";
import { FileLockService } from "#app-runtime/services/file-lock.service.js";
import type { AppInstanceRecord } from "#app-runtime/types/app-storage.types.js";
import type {
  AppInstallSourceKind,
  AppRegistry,
  AppRegistryAppRecord,
  AppRegistryInstalledVersion,
  AppSecretBinding,
} from "#app-runtime/types/app-registry.types.js";

export class AppRegistryService {
  private readonly fileLockService = new FileLockService();
  private readonly parser: AppRegistryParserService;

  constructor(
    private readonly appHomeService: AppHomeService = new AppHomeService(),
  ) {
    this.parser = new AppRegistryParserService(appHomeService);
  }

  load = async (): Promise<AppRegistry> => {
    try {
      const raw = await readFile(
        this.appHomeService.getRegistryPath(),
        "utf-8",
      );
      return this.parser.parse(JSON.parse(raw) as unknown);
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
    return Object.values(registry.apps).sort((left, right) =>
      left.appId.localeCompare(right.appId),
    );
  };

  getApp = async (appId: string): Promise<AppRegistryAppRecord | undefined> => {
    const registry = await this.load();
    return registry.apps[appId];
  };

  getActiveVersion = async (
    appId: string,
  ): Promise<AppRegistryInstalledVersion | undefined> => {
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
    target?: AppRegistryInstalledVersion["target"];
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
      const currentPublisher =
        currentRecord?.publisher ??
        currentRecord?.installedVersions[currentRecord.activeVersion]
          ?.publisher;
      if (currentPublisher && currentPublisher.id !== params.publisher?.id) {
        throw new Error(
          `应用 ${params.appId} 已绑定发布者 ${currentPublisher.id}，拒绝由 ${params.publisher?.id ?? "未验证本地来源"} 覆盖。`,
        );
      }
      const activeVersion =
        params.activate === false && currentRecord
          ? currentRecord.activeVersion
          : params.version;
      const activePermissions =
        activeVersion === params.version
          ? params.permissions
          : (currentRecord?.installedVersions[activeVersion]?.permissions ??
            {});
      const nextRecord: AppRegistryAppRecord = {
        appId: params.appId,
        name: params.name,
        description: params.description,
        publisher: currentPublisher ?? params.publisher,
        activeVersion,
        enabled:
          params.enabled ??
          currentRecord?.enabled ??
          params.manifestSchemaVersion === 1,
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
            target: params.target,
            publisher: params.publisher,
            manifestSchemaVersion: params.manifestSchemaVersion,
            components: params.components,
            primaryPanelId: params.primaryPanelId,
            security: params.security,
            dataSchemaVersion: params.dataSchemaVersion,
            contentSha256: params.contentSha256,
          },
        },
        grants: this.parser.retainCompatibleDocumentGrants(
          currentRecord?.grants ?? {},
          activePermissions,
        ),
        // A SecretRef is an active permission, not retained App data. Keep only
        // bindings declared by the active version so an update cannot leave an
        // undeclared credential reachable by a later runtime snapshot.
        secretBindings: this.parser.retainDeclaredSecretBindings(
          currentRecord?.secretBindings ?? {},
          activePermissions,
        ),
      };
      registry.apps[params.appId] = nextRecord;
      await this.saveUnlocked(registry);
      return nextRecord;
    });
  };

  setEnabled = async (
    appId: string,
    enabled: boolean,
  ): Promise<AppRegistryAppRecord> => {
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
      return {
        ...record,
        activeVersion: version,
        grants: this.parser.retainCompatibleDocumentGrants(
          record.grants,
          record.installedVersions[version].permissions,
        ),
        secretBindings: this.parser.retainDeclaredSecretBindings(
          record.secretBindings,
          record.installedVersions[version].permissions,
        ),
      };
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
      if (
        installedVersion.contentSha256 &&
        installedVersion.contentSha256 !== contentSha256
      ) {
        throw new Error(
          `应用 ${appId}@${version} 已存在不同的代码完整性摘要。`,
        );
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
    return await this.updateApp(appId, (record) => {
      const permissions =
        record.installedVersions[record.activeVersion]?.permissions ?? {};
      const scopes = new Map(
        (permissions.documentAccess ?? []).map((scope) => [scope.id, scope]),
      );
      const now = new Date().toISOString();
      const stored = Object.fromEntries(
        Object.entries(grants).map(([scopeId, directoryPath]) => {
          const scope = scopes.get(scopeId);
          if (!scope)
            throw new Error(
              `应用 ${appId} 未声明 documentAccess scope：${scopeId}`,
            );
          return [
            scopeId,
            { path: directoryPath, mode: scope.mode, grantedAt: now },
          ];
        }),
      );
      return { ...record, grants: { ...record.grants, ...stored } };
    });
  };

  setDocumentGrant = async (
    appId: string,
    scopeId: string,
    directoryPath: string,
    mode?: "read" | "read-write",
  ): Promise<AppRegistryAppRecord> => {
    return await this.updateApp(appId, (record) => {
      const scope = record.installedVersions[
        record.activeVersion
      ]?.permissions.documentAccess?.find((entry) => entry.id === scopeId);
      if (!scope)
        throw new Error(
          `应用 ${appId} 未声明 documentAccess scope：${scopeId}`,
        );
      const effectiveMode = mode ?? scope.mode;
      if (effectiveMode === "read-write" && scope.mode !== "read-write") {
        throw new Error(
          `应用 ${appId} 的 documentAccess scope ${scopeId} 只声明了 read。`,
        );
      }
      return {
        ...record,
        grants: {
          ...record.grants,
          [scopeId]: {
            path: directoryPath,
            mode: effectiveMode,
            grantedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  restoreDocumentGrant = async (
    appId: string,
    scopeId: string,
    grant: AppStoredDocumentGrant | undefined,
  ): Promise<void> => {
    await this.updateApp(appId, (record) => {
      const grants = { ...record.grants };
      if (grant) grants[scopeId] = grant;
      else delete grants[scopeId];
      return { ...record, grants };
    });
  };

  removeDocumentGrant = async (
    appId: string,
    scopeId: string,
  ): Promise<boolean> => {
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

  bindSecret = async (
    appId: string,
    slotId: string,
    binding: AppSecretBinding,
  ): Promise<AppRegistryAppRecord> => {
    const normalizedSlotId = this.parser.parseSecretSlotId(
      slotId,
      "secret slot id",
    );
    const normalizedBinding = this.parser.parseSecretBinding(
      binding,
      `secret binding ${normalizedSlotId}`,
    );
    return await this.updateApp(appId, (record) => {
      const activeVersion = record.installedVersions[record.activeVersion];
      const declaredSlots = activeVersion?.permissions.secrets ?? [];
      if (!declaredSlots.some((slot) => slot.id === normalizedSlotId)) {
        throw new Error(
          `应用 ${appId} 未声明 Secret slot：${normalizedSlotId}`,
        );
      }
      return {
        ...record,
        secretBindings: {
          ...record.secretBindings,
          [normalizedSlotId]: normalizedBinding,
        },
      };
    });
  };

  unbindSecret = async (appId: string, slotId: string): Promise<boolean> => {
    const normalizedSlotId = this.parser.parseSecretSlotId(
      slotId,
      "secret slot id",
    );
    let removed = false;
    await this.updateApp(appId, (record) => {
      if (!(normalizedSlotId in record.secretBindings)) {
        return record;
      }
      const secretBindings = { ...record.secretBindings };
      delete secretBindings[normalizedSlotId];
      removed = true;
      return { ...record, secretBindings };
    });
    return removed;
  };

  removeApp = async (
    appId: string,
  ): Promise<AppRegistryAppRecord | undefined> => {
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

  setBuiltInSuppressed = async (
    appId: string,
    suppressed: boolean,
  ): Promise<void> => {
    await this.withMutation(async () => {
      const registry = await this.load();
      if (suppressed) {
        registry.suppressedBuiltIns[appId] = {
          suppressedAt: new Date().toISOString(),
        };
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
    return await this.fileLockService.withLock(
      `${registryPath}.lock`,
      operation,
    );
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
