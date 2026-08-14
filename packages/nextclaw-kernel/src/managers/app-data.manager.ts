import { createHash } from "node:crypto";
import path from "node:path";
import {
  AppHomeService,
  AppInstanceInventoryService,
  FileLockService,
  type AppInstanceInventoryEntry,
} from "@nextclaw/app-runtime";
import {
  AppDataError,
  type AppDataDeleteResult,
  type AppDataEntry,
  type AppDataList,
  type AppDataSource,
} from "@kernel/types/app-data.types.js";

type WorkspaceDataOwner = {
  id: string;
  title: string;
};

type AppDataIdPayload = {
  version: 1;
  source: AppDataSource;
  appId: string;
  instanceId: string;
  scope?: string;
};

const DATA_ID_PREFIX = "ad1.";
const SAFE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const WORKSPACE_SCOPE_PATTERN = /^[a-f0-9]{16}$/;

export class AppDataManager {
  private readonly appHomeService: AppHomeService;
  private readonly fileLockService = new FileLockService();
  private readonly inventoryService = new AppInstanceInventoryService();

  constructor(private readonly params: {
    appHomeDirectory: string;
    getWorkspacePath: () => string;
    listInstalledPackageOwners: () => Promise<Array<{ id: string; name: string }>>;
    listWorkspaceDataOwners: () => Promise<WorkspaceDataOwner[]>;
  }) {
    this.appHomeService = new AppHomeService(params.appHomeDirectory);
  }

  list = async (): Promise<AppDataList> => {
    const workspacePath = path.resolve(this.params.getWorkspacePath());
    const workspaceInstancesRoot = this.getWorkspaceInstancesRoot(workspacePath);
    const [packageInventory, workspaceInventory, packageList, workspaceOwners] =
      await Promise.all([
        this.inventoryService.list(this.appHomeService.getInstancesDirectory()),
        this.inventoryService.list(workspaceInstancesRoot),
        this.params.listInstalledPackageOwners(),
        this.params.listWorkspaceDataOwners(),
      ]);
    const packageOwners = new Map(packageList.map((entry) => [entry.id, entry]));
    const workspaceOwnerMap = new Map(workspaceOwners.map((entry) => [entry.id, entry]));
    const workspaceScope = this.workspaceScope(workspacePath);
    const entries = [
      ...packageInventory.entries.map((entry) => this.toEntry({
        entry,
        source: "package",
        displayName: packageOwners.get(entry.appId)?.name ?? entry.appId,
        active: packageOwners.has(entry.appId),
      })),
      ...workspaceInventory.entries.map((entry) => this.toEntry({
        entry,
        source: "workspace-service",
        displayName: workspaceOwnerMap.get(entry.appId)?.title ?? entry.appId,
        active: workspaceOwnerMap.has(entry.appId),
        scope: workspaceScope,
      })),
    ].sort((left, right) =>
      left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));
    return {
      entries,
      diagnostics: [
        ...packageInventory.diagnostics.map((entry) => ({
          ...entry,
          source: "package" as const,
        })),
        ...workspaceInventory.diagnostics.map((entry) => ({
          ...entry,
          source: "workspace-service" as const,
        })),
      ],
    };
  };

  deleteRetained = async (
    dataId: string,
    confirmAppId: string,
  ): Promise<AppDataDeleteResult> => {
    const payload = this.parseDataId(dataId);
    if (confirmAppId !== payload.appId) {
      throw new AppDataError(
        "APP_DATA_CONFIRMATION_MISMATCH",
        `确认的 App id 与目标不一致：${confirmAppId || "(empty)"}`,
      );
    }
    if (payload.source === "package") {
      await this.deletePackageData(payload);
    } else {
      await this.deleteWorkspaceData(payload);
    }
    return {
      deleted: true,
      id: dataId,
      appId: payload.appId,
      instanceId: payload.instanceId,
    };
  };

  private deletePackageData = async (payload: AppDataIdPayload): Promise<void> => {
    await this.fileLockService.withLock(
      this.appHomeService.getAppOperationLockPath(payload.appId),
      async () => {
        await this.inventoryService.purge({
          instancesRoot: this.appHomeService.getInstancesDirectory(),
          appId: payload.appId,
          instanceId: payload.instanceId,
          assertCanPurge: async () => {
            if (await this.isPackageActive(payload.appId)) {
              throw new AppDataError(
                "APP_DATA_ACTIVE",
                `应用 ${payload.appId} 仍已安装，请通过卸载入口处理其数据。`,
              );
            }
          },
        });
      },
    ).catch((error) => this.rethrowMissing(error, payload));
  };

  private deleteWorkspaceData = async (payload: AppDataIdPayload): Promise<void> => {
    const workspacePath = path.resolve(this.params.getWorkspacePath());
    if (payload.scope !== this.workspaceScope(workspacePath)) {
      throw new AppDataError("APP_DATA_INVALID_ID", "App data id 不属于当前 workspace。");
    }
    const lockPath = path.join(
      workspacePath,
      ".nextclaw",
      "locks",
      "service-apps",
      `${payload.appId}.lock`,
    );
    await this.fileLockService.withLock(lockPath, async () => {
      await this.inventoryService.purge({
        instancesRoot: this.getWorkspaceInstancesRoot(workspacePath),
        appId: payload.appId,
        instanceId: payload.instanceId,
        assertCanPurge: async () => {
          if (await this.isWorkspaceServiceActive(payload.appId)) {
            throw new AppDataError(
              "APP_DATA_ACTIVE",
              `Service App ${payload.appId} 仍在 workspace 中，请通过 Service Apps 删除入口处理其数据。`,
            );
          }
        },
      });
    }).catch((error) => this.rethrowMissing(error, payload));
  };

  private toEntry = (params: {
    entry: AppInstanceInventoryEntry;
    source: AppDataSource;
    displayName: string;
    active: boolean;
    scope?: string;
  }): AppDataEntry => {
    const { active, displayName, entry, scope, source } = params;
    return {
      id: this.createDataId({
        version: 1,
        source,
        appId: entry.appId,
        instanceId: entry.instanceId,
        scope,
      }),
      appId: entry.appId,
      instanceId: entry.instanceId,
      publisherId: entry.publisherId,
      displayName,
      source,
      lifecycle: active ? "active" : "retained",
      storage: entry.storage,
      usage: entry.usage,
      createdAt: entry.createdAt,
      migratedAt: entry.migratedAt,
      actions: { deleteRetainedData: !active },
    };
  };

  private createDataId = (payload: AppDataIdPayload): string =>
    `${DATA_ID_PREFIX}${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;

  private parseDataId = (dataId: string): AppDataIdPayload => {
    try {
      if (!dataId.startsWith(DATA_ID_PREFIX)) {
        throw new Error("prefix");
      }
      const raw = JSON.parse(
        Buffer.from(dataId.slice(DATA_ID_PREFIX.length), "base64url").toString("utf8"),
      ) as Partial<AppDataIdPayload>;
      if (
        raw.version !== 1 ||
        (raw.source !== "package" && raw.source !== "workspace-service") ||
        typeof raw.appId !== "string" || !SAFE_ID_PATTERN.test(raw.appId) ||
        typeof raw.instanceId !== "string" || !SAFE_ID_PATTERN.test(raw.instanceId) ||
        (raw.source === "package" && raw.scope !== undefined) ||
        (raw.source === "workspace-service" &&
          (typeof raw.scope !== "string" || !WORKSPACE_SCOPE_PATTERN.test(raw.scope)))
      ) {
        throw new Error("shape");
      }
      return raw as AppDataIdPayload;
    } catch {
      throw new AppDataError("APP_DATA_INVALID_ID", "App data id 无效。");
    }
  };

  private isPackageActive = async (appId: string): Promise<boolean> =>
    (await this.params.listInstalledPackageOwners()).some((entry) => entry.id === appId);

  private isWorkspaceServiceActive = async (appId: string): Promise<boolean> =>
    (await this.params.listWorkspaceDataOwners()).some((entry) => entry.id === appId);

  private getWorkspaceInstancesRoot = (workspacePath: string): string =>
    path.join(workspacePath, ".nextclaw", "app-instances");

  private workspaceScope = (workspacePath: string): string =>
    createHash("sha256").update(workspacePath).digest("hex").slice(0, 16);

  private rethrowMissing = (error: unknown, payload: AppDataIdPayload): never => {
    if (
      error instanceof Error &&
      (error.message.includes("metadata 不存在") || this.isMissingFileError(error))
    ) {
      throw new AppDataError(
        "APP_DATA_NOT_FOUND",
        `未找到 App 数据：${payload.appId}/${payload.instanceId}`,
      );
    }
    throw error;
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
