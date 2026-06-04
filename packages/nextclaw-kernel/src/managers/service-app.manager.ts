import { readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  DEFAULT_SERVICE_APPS_DIR,
  getWorkspacePathFromConfig,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { McpServiceAppRuntimeService } from "@kernel/services/mcp-service-app-runtime.service.js";
import { ServiceActionGrantStore } from "@kernel/stores/service-action-grant.store.js";
import type {
  ServiceAction,
  ServiceActionCaller,
  ServiceActionGrant,
  ServiceActionGrantRequest,
  ServiceActionInvokeRequest,
  ServiceActionInvokeResult,
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import {
  getServiceAppManifestPath,
  readServiceAppManifest,
} from "@kernel/utils/service-app-manifest.utils.js";
import {
  getServiceActionName,
  resolveServiceActionGrantState,
} from "@kernel/utils/service-action.utils.js";
import {
  listServiceAppManifestActions,
  mergeServiceAppRuntimeActions,
} from "@kernel/utils/service-app-runtime-action.utils.js";

const SERVICE_ACTION_GRANTS_FILE_NAME = ".service-action-grants.json";

export type ServiceAppList = {
  workspacePath: string;
  serviceAppsPath: string;
  entries: ServiceAppRecord[];
};

export type ServiceAppDeleteResult = {
  deleted: true;
  id: string;
};

export type ServiceAppErrorCode =
  | "AUTHORIZATION_REQUIRED"
  | "SERVICE_APP_ACTION_NOT_DECLARED"
  | "SERVICE_APP_ACTION_NOT_FOUND"
  | "SERVICE_APP_INVALID_ACTION"
  | "SERVICE_APP_INVALID_CALLER"
  | "SERVICE_APP_INVALID_MANIFEST"
  | "SERVICE_APP_NOT_FOUND"
  | "SERVICE_APP_READ_FAILED"
  | "SERVICE_APP_RUNTIME_FAILED";

export class ServiceAppError extends Error {
  constructor(
    readonly code: ServiceAppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceAppError";
  }
}

export function isServiceAppError(error: unknown): error is ServiceAppError {
  return error instanceof ServiceAppError;
}

export class ServiceAppManager {
  private readonly runtimeService: ServiceAppRuntime;

  constructor(private readonly params: {
    configManager: ConfigManager;
    runtimeService?: ServiceAppRuntime;
  }) {
    this.runtimeService = params.runtimeService ?? new McpServiceAppRuntimeService({
      getConfig: () => params.configManager.config,
    });
  }

  listServiceApps = async (): Promise<ServiceAppList> => {
    const workspacePath = this.getWorkspacePath();
    const serviceAppsPath = this.getServiceAppsPath(workspacePath);
    const dirNames = await this.listServiceAppDirNames(serviceAppsPath);
    const entries = await Promise.all(
      dirNames.map((dirName) => this.buildServiceAppRecord(serviceAppsPath, dirName)),
    );
    return {
      workspacePath,
      serviceAppsPath,
      entries: entries
        .filter((entry): entry is ServiceAppRecord => Boolean(entry))
        .sort((left, right) => left.title.localeCompare(right.title)),
    };
  };

  getServiceApp = async (appId: string): Promise<ServiceAppRecord> => {
    const { record } = await this.requireServiceApp(appId);
    return record;
  };

  listServiceActions = async (params: {
    caller?: ServiceActionCaller;
    appId?: string;
    declaredActions?: readonly string[];
  } = {}): Promise<ServiceAction[]> => {
    const manifests = params.appId
      ? [await this.requireServiceApp(params.appId)]
      : await this.listValidServiceApps();
    const actions = manifests.flatMap(({ manifest, record }) =>
      listServiceAppManifestActions(record, manifest),
    );
    return await Promise.all(
      actions.map(async (action) => await this.withGrantState(action, params)),
    );
  };

  discoverServiceAppActions = async (appId: string): Promise<ServiceAction[]> => {
    const { manifest, record } = await this.requireServiceApp(appId);
    const runtimeActions = await this.runtimeService.listActions({ app: record, manifest });
    return mergeServiceAppRuntimeActions({ record, manifest, runtimeActions });
  };

  invokeServiceAction = async (
    actionId: string,
    request: ServiceActionInvokeRequest,
  ): Promise<ServiceActionInvokeResult> => {
    this.assertCaller(request.caller);
    this.assertDeclaredAction(actionId, request.declaredActions);
    const { manifest, record } = await this.requireServiceAppForAction(actionId);
    const actionName = getServiceActionName(actionId, record.id);
    if (!Object.hasOwn(manifest.actions, actionName)) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    if (!await this.createGrantStore().isGranted(request.caller, actionId)) {
      throw new ServiceAppError(
        "AUTHORIZATION_REQUIRED",
        `This panel app needs permission to call ${actionId}.`,
      );
    }
    const result = await this.runtimeService.invokeAction({
      app: record,
      manifest,
      actionName,
      input: request.input ?? {},
    });
    return { actionId, result };
  };

  grantServiceAction = async (
    actionId: string,
    request: ServiceActionGrantRequest,
  ): Promise<ServiceActionGrant> => {
    const [grant] = await this.grantServiceActions([actionId], request);
    if (!grant) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    return grant;
  };

  grantServiceActions = async (
    actionIds: readonly string[],
    request: ServiceActionGrantRequest,
  ): Promise<ServiceActionGrant[]> => {
    this.assertCaller(request.caller);
    const normalizedActionIds = this.normalizeActionIds(actionIds);
    if (normalizedActionIds.length === 0) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    const actions: ServiceAction[] = [];
    for (const actionId of normalizedActionIds) {
      this.assertDeclaredAction(actionId, request.declaredActions);
      actions.push(await this.requireServiceAction(actionId));
    }
    const grantedAt = new Date().toISOString();
    const grantStore = this.createGrantStore();
    const grants: ServiceActionGrant[] = [];
    for (const action of actions) {
      grants.push(await grantStore.grant({
        caller: request.caller,
        actionId: action.id,
        risk: action.risk,
        grantedAt,
      }));
    }
    return grants;
  };

  listServiceActionGrants = async (): Promise<ServiceActionGrant[]> => {
    return await this.createGrantStore().list();
  };

  revokeServiceAction = async (
    caller: ServiceActionCaller,
    actionId: string,
  ): Promise<void> => {
    this.assertCaller(caller);
    await this.createGrantStore().revoke(caller, actionId);
  };

  restartServiceApp = async (appId: string): Promise<ServiceAppRecord> => {
    const { record } = await this.requireServiceApp(appId);
    await this.runtimeService.restart(record.id);
    return await this.getServiceApp(appId);
  };

  deleteServiceApp = async (appId: string): Promise<ServiceAppDeleteResult> => {
    const { record } = await this.requireServiceApp(appId);
    await this.runtimeService.restart(record.id);
    await rm(record.dirPath, { recursive: true });
    await this.createGrantStore().revokeActionsByPrefix(`${record.id}.`);
    return {
      deleted: true,
      id: record.id,
    };
  };

  dispose = async (): Promise<void> => {
    await this.runtimeService.dispose();
  };

  private withGrantState = async (
    action: ServiceAction,
    params: {
      caller?: ServiceActionCaller;
      declaredActions?: readonly string[];
    },
  ): Promise<ServiceAction> => {
    if (!params.caller) {
      return action;
    }
    const granted = await this.createGrantStore().isGranted(params.caller, action.id);
    return {
      ...action,
      grantState: resolveServiceActionGrantState({
        actionId: action.id,
        declaredActions: params.declaredActions,
        granted,
      }),
    };
  };

  private requireServiceAction = async (actionId: string): Promise<ServiceAction> => {
    const { manifest, record } = await this.requireServiceAppForAction(actionId);
    const action = listServiceAppManifestActions(record, manifest)
      .find((entry) => entry.id === actionId);
    if (!action) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    return action;
  };

  private requireServiceAppForAction = async (
    actionId: string,
  ): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const appId = actionId.split(".")[0]?.trim();
    if (!appId) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    return await this.requireServiceApp(appId);
  };

  private requireServiceApp = async (
    appId: string,
  ): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const serviceAppsPath = this.getServiceAppsPath(this.getWorkspacePath());
    const dirPath = join(serviceAppsPath, appId);
    try {
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) {
        throw new ServiceAppError("SERVICE_APP_NOT_FOUND", "service app not found");
      }
      const manifest = await readServiceAppManifest(dirPath);
      if (manifest.id !== appId) {
        throw new ServiceAppError(
          "SERVICE_APP_INVALID_MANIFEST",
          "service app manifest id must match directory name",
        );
      }
      return {
        manifest,
        record: this.toServiceAppRecord(dirPath, manifest),
      };
    } catch (error) {
      if (isServiceAppError(error)) {
        throw error;
      }
      if (this.isMissingFileError(error)) {
        throw new ServiceAppError("SERVICE_APP_NOT_FOUND", "service app not found");
      }
      throw new ServiceAppError(
        "SERVICE_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private listValidServiceApps = async (): Promise<Array<{
    manifest: ServiceAppManifest;
    record: ServiceAppRecord;
  }>> => {
    const workspacePath = this.getWorkspacePath();
    const serviceAppsPath = this.getServiceAppsPath(workspacePath);
    const dirNames = await this.listServiceAppDirNames(serviceAppsPath);
    const entries = await Promise.all(
      dirNames.map(async (dirName) => {
        const dirPath = join(serviceAppsPath, dirName);
        try {
          const manifest = await readServiceAppManifest(dirPath);
          return {
            manifest,
            record: this.toServiceAppRecord(dirPath, manifest),
          };
        } catch {
          return null;
        }
      }),
    );
    return entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  };

  private buildServiceAppRecord = async (
    serviceAppsPath: string,
    dirName: string,
  ): Promise<ServiceAppRecord | null> => {
    const dirPath = join(serviceAppsPath, dirName);
    try {
      const manifest = await readServiceAppManifest(dirPath);
      return this.toServiceAppRecord(dirPath, manifest);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return null;
      }
      return {
        id: dirName,
        title: toTitle(dirName),
        dirPath,
        manifestPath: getServiceAppManifestPath(dirPath),
        cwd: dirPath,
        enabled: false,
        protocol: "mcp",
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  };

  private toServiceAppRecord = (
    dirPath: string,
    manifest: ServiceAppManifest,
  ): ServiceAppRecord => {
    const runtimeStatus = this.runtimeService.getStatus(manifest.id);
    return {
      id: manifest.id,
      title: manifest.title,
      description: manifest.description,
      dirPath,
      manifestPath: getServiceAppManifestPath(dirPath),
      command: manifest.command,
      args: manifest.args,
      cwd: dirPath,
      enabled: manifest.enabled,
      protocol: manifest.protocol,
      status: manifest.enabled ? runtimeStatus.status : "stopped",
      lastError: runtimeStatus.lastError,
      lastStartedAt: runtimeStatus.lastStartedAt,
      lastReadyAt: runtimeStatus.lastReadyAt,
      lastFailedAt: runtimeStatus.lastFailedAt,
    };
  };

  private assertCaller = (caller: ServiceActionCaller): void => {
    if (caller.surface !== "panel-app" || !caller.appId.trim()) {
      throw new ServiceAppError("SERVICE_APP_INVALID_CALLER", "service action caller is invalid");
    }
  };

  private assertDeclaredAction = (
    actionId: string,
    declaredActions: readonly string[],
  ): void => {
    if (!declaredActions.includes(actionId)) {
      throw new ServiceAppError(
        "SERVICE_APP_ACTION_NOT_DECLARED",
        "panel app did not declare this service action",
      );
    }
  };

  private normalizeActionIds = (actionIds: readonly string[]): string[] =>
    Array.from(new Set(
      actionIds
        .map((actionId) => actionId.trim())
        .filter((actionId) => actionId.length > 0),
    ));

  private getWorkspacePath = (): string =>
    getWorkspacePathFromConfig(this.params.configManager.config);

  private getServiceAppsPath = (workspacePath: string): string =>
    join(workspacePath, DEFAULT_SERVICE_APPS_DIR);

  private createGrantStore = (): ServiceActionGrantStore =>
    new ServiceActionGrantStore(
      join(this.getServiceAppsPath(this.getWorkspacePath()), SERVICE_ACTION_GRANTS_FILE_NAME),
    );

  private listServiceAppDirNames = async (
    serviceAppsPath: string,
  ): Promise<string[]> => {
    try {
      const entries = await readdir(serviceAppsPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      throw new ServiceAppError(
        "SERVICE_APP_READ_FAILED",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" && error !== null &&
    (error as { code?: unknown }).code === "ENOENT";
}

type ServiceAppRuntime = Pick<
  McpServiceAppRuntimeService,
  "dispose" | "getStatus" | "invokeAction" | "listActions" | "restart"
>;

function toTitle(value: string): string {
  return basename(value).replace(/[-_]+/g, " ").trim() || value;
}
