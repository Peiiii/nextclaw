import { readFile, writeFile } from "node:fs/promises";
import type { AppPermissions } from "../manifest/app-manifest.types.js";
import type { AppDocumentGrantMap } from "../permissions/app-permissions.types.js";
import { AppHomeService } from "../paths/app-home.service.js";
import type {
  AppInstallSourceKind,
  AppRegistry,
  AppRegistryAppRecord,
  AppRegistryInstalledVersion,
} from "./app-registry.types.js";

export class AppRegistryService {
  constructor(private readonly appHomeService: AppHomeService = new AppHomeService()) {}

  load = async (): Promise<AppRegistry> => {
    await this.appHomeService.ensureBaseDirectories();
    const registryPath = this.appHomeService.getRegistryPath();
    try {
      const raw = await readFile(registryPath, "utf-8");
      return this.parseRegistry(JSON.parse(raw) as unknown);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return {
          schemaVersion: 1,
          apps: {},
        };
      }
      throw error;
    }
  };

  save = async (registry: AppRegistry): Promise<void> => {
    await this.appHomeService.ensureBaseDirectories();
    await writeFile(
      this.appHomeService.getRegistryPath(),
      `${JSON.stringify(registry, null, 2)}\n`,
      "utf-8",
    );
  };

  listApps = async (): Promise<AppRegistryAppRecord[]> => {
    const registry = await this.load();
    return Object.values(registry.apps).sort((left, right) => left.appId.localeCompare(right.appId));
  };

  getApp = async (appId: string): Promise<AppRegistryAppRecord | undefined> => {
    const registry = await this.load();
    return registry.apps[appId];
  };

  getActiveVersion = async (
    appId: string,
  ): Promise<AppRegistryInstalledVersion | undefined> => {
    const appRecord = await this.getApp(appId);
    if (!appRecord) {
      return undefined;
    }
    return appRecord.installedVersions[appRecord.activeVersion];
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
    permissions: AppPermissions;
  }): Promise<AppRegistryAppRecord> => {
    const {
      appId,
      name,
      description,
      version,
      installDirectory,
      dataDirectory,
      sourceKind,
      sourceRef,
      installedAt,
      permissions,
    } = params;
    const registry = await this.load();
    const currentRecord = registry.apps[appId];
    const nextRecord: AppRegistryAppRecord = {
      appId,
      name,
      description,
      activeVersion: version,
      dataDirectory,
      installedVersions: {
        ...(currentRecord?.installedVersions ?? {}),
        [version]: {
          version,
          installDirectory,
          sourceKind,
          sourceRef,
          installedAt,
          permissions,
        },
      },
      grants: currentRecord?.grants ?? {},
    };
    registry.apps[appId] = nextRecord;
    await this.save(registry);
    return nextRecord;
  };

  updateGrants = async (
    appId: string,
    grants: AppDocumentGrantMap,
  ): Promise<AppRegistryAppRecord> => {
    const registry = await this.load();
    const appRecord = registry.apps[appId];
    if (!appRecord) {
      throw new Error(`未找到已安装应用：${appId}`);
    }
    appRecord.grants = {
      ...appRecord.grants,
      ...grants,
    };
    registry.apps[appId] = appRecord;
    await this.save(registry);
    return appRecord;
  };

  removeApp = async (appId: string): Promise<AppRegistryAppRecord | undefined> => {
    const registry = await this.load();
    const appRecord = registry.apps[appId];
    if (!appRecord) {
      return undefined;
    }
    delete registry.apps[appId];
    await this.save(registry);
    return appRecord;
  };

  private parseRegistry = (rawRegistry: unknown): AppRegistry => {
    if (!rawRegistry || typeof rawRegistry !== "object" || Array.isArray(rawRegistry)) {
      throw new Error("registry.json 必须是对象。");
    }
    const candidate = rawRegistry as Record<string, unknown>;
    if (candidate.schemaVersion !== 1) {
      throw new Error("当前只支持 registry schemaVersion = 1。");
    }
    const apps = candidate.apps;
    if (!apps || typeof apps !== "object" || Array.isArray(apps)) {
      throw new Error("registry.apps 必须是对象。");
    }
    return {
      schemaVersion: 1,
      apps: apps as Record<string, AppRegistryAppRecord>,
    };
  };
}
