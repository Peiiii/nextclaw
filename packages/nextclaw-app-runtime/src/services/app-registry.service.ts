import { open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { AppPermissions, AppResolvedComponent } from "#app-runtime/types/app-manifest.types.js";
import type { AppDocumentGrantMap } from "#app-runtime/types/app-permissions.types.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import type {
  AppInstallSourceKind,
  AppRegistry,
  AppRegistryAppRecord,
  AppRegistryInstalledVersion,
} from "#app-runtime/types/app-registry.types.js";

export class AppRegistryService {
  private static readonly mutationQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly appHomeService: AppHomeService = new AppHomeService()) {}

  load = async (): Promise<AppRegistry> => {
    await this.appHomeService.ensureBaseDirectories();
    try {
      const raw = await readFile(this.appHomeService.getRegistryPath(), "utf-8");
      return this.parseRegistry(JSON.parse(raw) as unknown);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return { schemaVersion: 1, apps: {} };
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
    dataDirectory: string;
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
    enabled?: boolean;
  }): Promise<AppRegistryAppRecord> => {
    return await this.withMutation(async () => {
      const registry = await this.load();
      const currentRecord = registry.apps[params.appId];
      const nextRecord: AppRegistryAppRecord = {
        appId: params.appId,
        name: params.name,
        description: params.description,
        activeVersion: params.version,
        enabled: params.enabled ?? currentRecord?.enabled ?? params.manifestSchemaVersion === 1,
        dataDirectory: params.dataDirectory,
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
    const previous = AppRegistryService.mutationQueues.get(registryPath) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    AppRegistryService.mutationQueues.set(registryPath, current);
    try {
      return await current;
    } finally {
      if (AppRegistryService.mutationQueues.get(registryPath) === current) {
        AppRegistryService.mutationQueues.delete(registryPath);
      }
    }
  };

  private parseRegistry = (rawRegistry: unknown): AppRegistry => {
    const candidate = this.assertRecord(rawRegistry, "registry.json");
    if (candidate.schemaVersion !== 1) {
      throw new Error("当前只支持 registry schemaVersion = 1。");
    }
    const rawApps = this.assertRecord(candidate.apps, "registry.apps");
    const apps: Record<string, AppRegistryAppRecord> = {};
    for (const [appId, rawApp] of Object.entries(rawApps)) {
      const app = this.assertRecord(rawApp, `registry.apps.${appId}`) as Partial<AppRegistryAppRecord>;
      const installedVersions: Record<string, AppRegistryInstalledVersion> = {};
      const rawVersions = this.assertRecord(
        app.installedVersions,
        `registry.apps.${appId}.installedVersions`,
      );
      for (const [version, rawVersion] of Object.entries(rawVersions)) {
        const versionRecord = this.assertRecord(
          rawVersion,
          `registry.apps.${appId}.installedVersions.${version}`,
        ) as Partial<AppRegistryInstalledVersion>;
        installedVersions[version] = {
          ...(versionRecord as AppRegistryInstalledVersion),
          version,
          manifestSchemaVersion: versionRecord.manifestSchemaVersion === 2 ? 2 : 1,
        };
      }
      const activeVersion = this.requireString(app.activeVersion, `registry.apps.${appId}.activeVersion`);
      if (!installedVersions[activeVersion]) {
        throw new Error(`registry.apps.${appId} 缺少 activeVersion ${activeVersion}。`);
      }
      apps[appId] = {
        ...(app as AppRegistryAppRecord),
        appId,
        enabled: typeof app.enabled === "boolean" ? app.enabled : true,
        activeVersion,
        installedVersions,
        grants: app.grants && typeof app.grants === "object" ? app.grants : {},
      };
    }
    return { schemaVersion: 1, apps };
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
