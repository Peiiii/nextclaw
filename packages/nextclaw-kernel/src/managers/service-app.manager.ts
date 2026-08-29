import { stat } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_SERVICE_APPS_DIR,
  getWorkspacePathFromConfig,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import {
  AppPackageError,
  type AppPackageComponentSource,
} from "@kernel/types/app-package.types.js";
import { ServiceAppRuntimeService } from "@kernel/services/service-app-runtime.service.js";
import { ServiceAppLifecycleService } from "@kernel/services/service-app-lifecycle.service.js";
import { ServiceAppRecordService } from "@kernel/services/service-app-record.service.js";
import type { WorkspaceServiceDataOwner } from "@kernel/services/service-app-record.service.js";
import {
  type ServiceAppRemovalDiagnostic,
  ServiceAppRemovalCleanupError,
  ServiceAppRemovalService,
} from "@kernel/services/service-app-removal.service.js";
import {
  createServiceActionGrantRequest,
  getCapabilityGrantKey,
  readServiceActionTargetId,
  type CapabilityGrant,
  type CapabilityGrantManager,
} from "@kernel/features/capability-grants/index.js";
import { ServiceActionGrantService } from "@kernel/services/service-action-grant.service.js";
import { ServiceAppPackageRuntimeService } from "@kernel/services/service-app-package-runtime.service.js";
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
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";
import {
  assertServiceActionCaller,
  assertServiceActionDeclared,
  getServiceActionName,
  resolveServiceActionGrantState,
} from "@kernel/utils/service-action.utils.js";
import {
  listServiceAppManifestActions,
  mergeServiceAppRuntimeActions,
} from "@kernel/utils/service-app-runtime-action.utils.js";
import {
  isServiceAppError,
  ServiceAppError,
  toServiceAppRuntimeError,
} from "@kernel/utils/service-app-error.utils.js";

export type { WorkspaceServiceDataOwner } from "@kernel/services/service-app-record.service.js";
export {
  isServiceAppError,
  ServiceAppError,
  type ServiceAppErrorCode,
} from "@kernel/utils/service-app-error.utils.js";

const SERVICE_APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ServiceAppList = {
  workspacePath: string;
  serviceAppsPath: string;
  entries: ServiceAppRecord[];
  diagnostics: ServiceAppRemovalDiagnostic[];
};

export type ServiceAppDeleteResult = {
  deleted: true;
  id: string;
  dataRemoved: boolean;
};

export class ServiceAppManager {
  private readonly removalService = new ServiceAppRemovalService();
  private readonly runtimeService: ServiceAppRuntime;
  private readonly recordService: ServiceAppRecordService;
  private readonly actionGrants: ServiceActionGrantService;
  private readonly packageRuntime: ServiceAppPackageRuntimeService;
  private readonly lifecycleService: ServiceAppLifecycleService;
  private reconciliationDiagnostics: ServiceAppRemovalDiagnostic[] = [];

  constructor(private readonly params: {
    configManager: ConfigManager;
    runtimeService?: ServiceAppRuntime;
    listPackageComponentSources?: () => Promise<AppPackageComponentSource[]>;
    capabilityGrantManager: CapabilityGrantManager;
    hasAgent?: (agentId: string) => boolean;
    portableServiceRunnerPath?: string;
  }) {
    this.runtimeService = params.runtimeService ?? new ServiceAppRuntimeService({
      getConfig: () => params.configManager.config,
      portableServiceRunnerPath: params.portableServiceRunnerPath,
    });
    this.recordService = new ServiceAppRecordService({
      getWorkspacePath: this.getWorkspacePath,
      runtimeService: this.runtimeService,
    });
    this.lifecycleService = new ServiceAppLifecycleService({
      recordService: this.recordService,
      runtimeService: this.runtimeService,
    });
    this.actionGrants = new ServiceActionGrantService({
      capabilityGrantManager: params.capabilityGrantManager,
      resolveAction: this.requireServiceAction,
    });
    this.packageRuntime = new ServiceAppPackageRuntimeService({
      getStatus: this.runtimeService.getStatus,
      restore: async (serviceId) => {
        await this.discoverServiceAppActions(serviceId);
      },
      stop: this.runtimeService.stop,
    });
  }

  start = async (): Promise<void> => {
    this.reconciliationDiagnostics = await this.removalService.reconcile({
      capabilityGrantManager: this.params.capabilityGrantManager,
      lockPathForAppId: (appId) => this.getServiceAppLockPath(this.getWorkspacePath(), appId),
      serviceAppsPath: this.getServiceAppsPath(this.getWorkspacePath()),
    });
    await this.lifecycleService.startDiscovered(await this.listValidServiceApps());
  };

  listServiceApps = async (): Promise<ServiceAppList> => {
    const workspacePath = this.getWorkspacePath();
    const serviceAppsPath = this.getServiceAppsPath(workspacePath);
    const dirNames = await this.listServiceAppDirNames(serviceAppsPath);
    const workspaceEntries = await Promise.all(
      dirNames.map((dirName) => this.recordService.buildWorkspaceRecord(serviceAppsPath, dirName)),
    );
    const packageSources = (await this.listPackageComponentSources())
      .filter((component) => component.kind === "service");
    const packageEntries = await Promise.all(
      packageSources.map((source) => this.recordService.buildPackageRecord(source)),
    );
    return {
      workspacePath,
      serviceAppsPath,
      diagnostics: this.reconciliationDiagnostics,
      entries: [...workspaceEntries, ...packageEntries]
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
    const { manifest, record } = await this.requireServiceApp(appId, true);
    const runtimeActions = await this.runtimeService.listActions({ app: record, manifest });
    return mergeServiceAppRuntimeActions({ record, manifest, runtimeActions });
  };

  invokeServiceAction = async (
    actionId: string,
    request: ServiceActionInvokeRequest,
  ): Promise<ServiceActionInvokeResult> => {
    assertServiceActionCaller(request.caller, this.params.hasAgent);
    assertServiceActionDeclared(request.caller, actionId, request.declaredActions);
    const { manifest, record } = await this.requireServiceAppForAction(actionId, true);
    const actionName = getServiceActionName(actionId, record.id);
    if (!Object.hasOwn(manifest.actions, actionName)) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    const action = listServiceAppManifestActions(record, manifest)
      .find((entry) => entry.id === actionId);
    if (!action) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    if (!(await this.actionGrants.isGranted(request.caller, action))) {
      throw new ServiceAppError(
        "AUTHORIZATION_REQUIRED",
        `This panel app needs permission to call ${actionId}.`,
      );
    }
    try {
      const result = await this.runtimeService.invokeAction({
        app: record,
        manifest,
        actionName,
        input: request.input ?? {},
      });
      return { actionId, result };
    } catch (error) {
      throw toServiceAppRuntimeError(error, record.id, actionName);
    }
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
    assertServiceActionCaller(request.caller, this.params.hasAgent);
    const normalizedActionIds = this.normalizeActionIds(actionIds);
    if (normalizedActionIds.length === 0) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    const actions: ServiceAction[] = [];
    for (const actionId of normalizedActionIds) {
      assertServiceActionDeclared(request.caller, actionId, request.declaredActions);
      actions.push(await this.requireServiceAction(actionId));
    }
    return await this.actionGrants.grant(request.caller, actions);
  };

  listServiceActionGrants = async (): Promise<ServiceActionGrant[]> =>
    await this.actionGrants.list();

  revokeServiceAction = async (
    caller: ServiceActionCaller,
    actionId: string,
  ): Promise<void> => {
    assertServiceActionCaller(caller, this.params.hasAgent);
    await this.actionGrants.revoke(caller, actionId);
  };

  matchesCapabilityGrant = async (grant: CapabilityGrant): Promise<boolean> => {
    if (
      (grant.subject.type !== "panel-app" && grant.subject.type !== "agent") ||
      grant.resource.type !== "service.action"
    ) {
      return false;
    }
    const actionId = readServiceActionTargetId(grant.resource.target);
    if (!actionId) return false;
    try {
      const action = await this.requireServiceAction(actionId);
      return getCapabilityGrantKey(grant) === getCapabilityGrantKey(
        createServiceActionGrantRequest(
          grant.subject.type === "panel-app"
            ? { surface: "panel-app", appId: grant.subject.id }
            : { surface: "agent", agentId: grant.subject.id },
          action,
        ),
      );
    } catch {
      return false;
    }
  };

  restartServiceApp = async (appId: string): Promise<ServiceAppRecord> => {
    const { record } = await this.requireServiceApp(appId);
    await this.runtimeService.restart(record.id);
    return await this.getServiceApp(appId);
  };

  listWorkspaceDataOwners = async (): Promise<WorkspaceServiceDataOwner[]> =>
    await this.recordService.listWorkspaceDataOwners(
      this.getServiceAppsPath(this.getWorkspacePath()),
      await this.listServiceAppDirNames(this.getServiceAppsPath(this.getWorkspacePath())),
    );

  deleteServiceApp = async (appId: string, purgeData = false): Promise<ServiceAppDeleteResult> => {
    if (!SERVICE_APP_ID_PATTERN.test(appId)) {
      throw new ServiceAppError(
        "SERVICE_APP_INVALID_MANIFEST",
        "service app id must use kebab-case",
      );
    }
    const workspacePath = this.getWorkspacePath();
    let record: ServiceAppRecord;
    try {
      record = await this.removalService.remove({
        capabilityGrantManager: this.params.capabilityGrantManager,
        lockPath: this.getServiceAppLockPath(workspacePath, appId),
        purgeData,
        loadRecord: async () => {
          const { record } = await this.requireServiceApp(appId);
          if (record.sourceKind === "package") {
            throw new ServiceAppError(
              "SERVICE_APP_MANAGED_SOURCE",
              `package service must be managed through Apps: ${record.packageId}`,
            );
          }
          return record;
        },
        stopRuntime: async (loaded) => await this.runtimeService.stop(loaded.id),
      });
    } catch (error) {
      if (error instanceof ServiceAppRemovalCleanupError) {
        throw new ServiceAppError(
          "SERVICE_APP_RUNTIME_FAILED",
          `Service App ${appId} 已从 workspace 移除，但${error.message}`,
        );
      }
      throw error;
    }
    return { deleted: true, id: record.id, dataRemoved: purgeData };
  };

  dispose = async (): Promise<void> => await this.runtimeService.dispose();

  assertCanActivatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => {
    const serviceComponents = components.filter((component) => component.kind === "service");
    if (serviceComponents.length === 0) {
      return;
    }
    const workspacePath = this.getServiceAppsPath(this.getWorkspacePath());
    const workspaceIds = new Set<string>();
    for (const dirName of await this.listServiceAppDirNames(workspacePath)) {
      try {
        workspaceIds.add((await readServiceAppManifest(join(workspacePath, dirName))).id);
      } catch {
        continue;
      }
    }
    const activePackageSources = await this.listPackageComponentSources();
    for (const component of serviceComponents) {
      const conflictsWithPackage = activePackageSources.some((active) =>
        active.kind === "service" &&
        active.id === component.id &&
        active.packageId !== component.packageId,
      );
      if (workspaceIds.has(component.id) || conflictsWithPackage) {
        throw new AppPackageError(
          "APP_PACKAGE_CONFLICT",
          `Service component id 冲突：${component.id}`,
        );
      }
    }
    for (const component of serviceComponents) {
      let manifest: ServiceAppManifest;
      try {
        manifest = await readServiceAppManifest(component.sourcePath);
      } catch (error) {
        throw new AppPackageError(
          "APP_PACKAGE_OPERATION_FAILED",
          `Service component ${component.id} manifest 无效：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        const record = this.recordService.fromManifest(
          component.sourcePath,
          manifest,
          component,
          component.storage,
        );
        const runtimeActions = await this.runtimeService.listActions({ app: record, manifest });
        const runtimeStatus = this.runtimeService.getStatus(component.id);
        if (runtimeStatus.status === "failed") {
          throw new AppPackageError(
            "APP_PACKAGE_OPERATION_FAILED",
            `Service component ${component.id} 启动探测失败：${runtimeStatus.lastError ?? "unknown error"}`,
          );
        }
        const actions = mergeServiceAppRuntimeActions({ record, manifest, runtimeActions });
        const invalidAction = actions.find(
          (action) => action.runtimeState === "missing" || action.runtimeState === "undeclared",
        );
        if (invalidAction) {
          throw new AppPackageError(
            "APP_PACKAGE_OPERATION_FAILED",
            `Service component ${component.id} action 合同不一致：${invalidAction.id} (${invalidAction.runtimeState})`,
          );
        }
      } finally {
        await this.runtimeService.restart(component.id);
      }
    }
  };

  activatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => await this.lifecycleService.activatePackageComponents(components);

  deactivatePackageComponents = async (
    components: AppPackageComponentSource[],
  ): Promise<void> => await this.lifecycleService.deactivatePackageComponents(components);

  preparePackageComponentDeactivation = async (
    components: AppPackageComponentSource[],
  ): Promise<() => Promise<void>> =>
    await this.packageRuntime.prepareDeactivation(components);

  removePackageComponentGrants = async (
    components: AppPackageComponentSource[],
  ): Promise<() => Promise<void>> =>
    await this.actionGrants.removePackageGrants(new Set(
      components
        .filter((component) => component.kind === "service")
        .map((component) => component.id),
    ));



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
    const granted = await this.actionGrants.isGranted(params.caller, action);
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
    actionId: string, materializeStorage = false,
  ): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const appId = actionId.split(".")[0]?.trim();
    if (!appId) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    return await this.requireServiceApp(appId, materializeStorage);
  };

  private requireServiceApp = async (
    appId: string, materializeStorage = false,
  ): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const serviceAppsPath = this.getServiceAppsPath(this.getWorkspacePath());
    let dirPath = join(serviceAppsPath, appId);
    let packageSource: AppPackageComponentSource | undefined;
    try {
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) {
        throw new ServiceAppError("SERVICE_APP_NOT_FOUND", "service app not found");
      }
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        throw error;
      }
      packageSource = (await this.listPackageComponentSources()).find((component) =>
        component.kind === "service" && component.id === appId,
      );
      if (!packageSource) {
        throw new ServiceAppError("SERVICE_APP_NOT_FOUND", "service app not found");
      }
      dirPath = packageSource.sourcePath;
    }
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
      const storage = packageSource?.storage ?? (materializeStorage
        ? await this.recordService.materializeWorkspaceStorage(manifest.id)
        : await this.recordService.inspectWorkspaceStorage(manifest.id));
      return {
        manifest,
        record: this.recordService.fromManifest(
          dirPath,
          manifest,
          packageSource,
          storage,
        ),
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
    const workspaceEntries = await Promise.all(
      dirNames.map(async (dirName) => {
        const dirPath = join(serviceAppsPath, dirName);
        try {
          const manifest = await readServiceAppManifest(dirPath);
          return {
            manifest,
            record: this.recordService.fromManifest(
              dirPath,
              manifest,
              undefined,
              await this.recordService.inspectWorkspaceStorage(manifest.id),
            ),
          };
        } catch {
          return null;
        }
      }),
    );
    const packageEntries = await Promise.all(
      (await this.listPackageComponentSources())
        .filter((component) => component.kind === "service")
        .map(async (component) => {
          try {
            const manifest = await readServiceAppManifest(component.sourcePath);
            return {
              manifest,
              record: this.recordService.fromManifest(
                component.sourcePath,
                manifest,
                component,
                component.storage,
              ),
            };
          } catch {
            return null;
          }
        }),
    );
    return [...workspaceEntries, ...packageEntries]
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  };

  private normalizeActionIds = (actionIds: readonly string[]): string[] =>
    Array.from(new Set(
      actionIds
        .map((actionId) => actionId.trim())
        .filter((actionId) => actionId.length > 0),
    ));

  private getWorkspacePath = (): string => getWorkspacePathFromConfig(this.params.configManager.config);

  private getServiceAppsPath = (workspacePath: string): string => join(workspacePath, DEFAULT_SERVICE_APPS_DIR);

  private getServiceAppLockPath = (workspacePath: string, appId: string): string => join(workspacePath, ".nextclaw", "locks", "service-apps", `${appId}.lock`);

  private listPackageComponentSources = async (): Promise<AppPackageComponentSource[]> =>
    await this.params.listPackageComponentSources?.() ?? [];

  private listServiceAppDirNames = async (
    serviceAppsPath: string,
  ): Promise<string[]> => {
    try {
      return await this.removalService.listCanonicalDirectoryNames(serviceAppsPath);
    } catch (error) {
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
  ServiceAppRuntimeService,
  "dispose" | "getStatus" | "invokeAction" | "listActions" | "restart" | "stop"
> & Pick<Partial<ServiceAppRuntimeService>, "start">;
