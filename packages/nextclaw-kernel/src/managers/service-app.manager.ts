import { join } from "node:path";
import { DEFAULT_SERVICE_APPS_DIR, getWorkspacePathFromConfig } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { type AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import { ServiceAppRuntimeService } from "@kernel/services/service-app-runtime.service.js";
import { ServiceAppLifecycleService } from "@kernel/services/service-app-lifecycle.service.js";
import { ServiceAppAiCapabilityService } from "@kernel/services/service-app-ai-capability.service.js";
import { ServiceAppJobManager } from "@kernel/managers/service-app-job.manager.js";
import { ServiceAppActivationManager } from "@kernel/managers/service-app-activation.manager.js";
import { hasConfiguredServiceModel, ServiceAppAiManager } from "@kernel/managers/service-app-ai.manager.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import type { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import { ServiceAppRecordService, type WorkspaceServiceDataOwner } from "@kernel/services/service-app-record.service.js";
import { type ServiceAppRemovalDiagnostic, ServiceAppRemovalCleanupError, ServiceAppRemovalService } from "@kernel/services/service-app-removal.service.js";
import { createServiceActionGrantRequest, getCapabilityGrantKey, readServiceActionTargetId, type CapabilityGrant, type CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import { ServiceActionGrantService } from "@kernel/services/service-action-grant.service.js";
import { ServiceAppPackageRuntimeService } from "@kernel/services/service-app-package-runtime.service.js";
import type { VerificationRecordService } from "@kernel/services/verification-record.service.js";
import { ServiceAppJobJournalService, type ServiceAppJobScope } from "@kernel/services/service-app-job-journal.service.js";
import { ServiceAppResidentEventInboxService, type ResidentEventInput } from "@kernel/services/service-app-resident-event-inbox.service.js";
import { projectCapabilityProviders } from "@kernel/utils/service-app-capability-provider.utils.js";
import type {
  ServiceAction,
  ServiceActionCaller,
  ServiceActionGrant,
  ServiceActionGrantRequest,
  ServiceActionInvokeRequest,
  ServiceActionInvokeResult,
  ServiceAppJobCaller,
  ServiceAppManifest,
  ServiceAppRecord,
} from "@kernel/types/service-app.types.js";
import { readServiceAppManifest } from "@kernel/utils/service-app-manifest.utils.js";
import { assertServiceActionCaller, assertServiceActionDeclared, buildServiceActionId, getServiceActionName, resolveServiceActionGrantState } from "@kernel/utils/service-action.utils.js";
import { listServiceAppManifestActions, mergeServiceAppRuntimeActions } from "@kernel/utils/service-app-runtime-action.utils.js";
import { ServiceAppError } from "@kernel/utils/service-app-error.utils.js";
export type { WorkspaceServiceDataOwner } from "@kernel/services/service-app-record.service.js";
export { isServiceAppError, ServiceAppError, type ServiceAppErrorCode } from "@kernel/utils/service-app-error.utils.js";

const SERVICE_APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DOCUMENT_GUEST_PATH_PATTERN = /^\/documents\/([^/]+)(?:\/|$)/;

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
  readonly aiCapabilities: ServiceAppAiCapabilityService;
  private readonly aiManager: ServiceAppAiManager;
  private readonly verificationRecords?: VerificationRecordService;
  private readonly jobJournal: ServiceAppJobJournalService;
  private readonly jobManager: ServiceAppJobManager;
  private readonly activationManager: ServiceAppActivationManager;
  private readonly residentInbox: ServiceAppResidentEventInboxService;
  private reconciliationDiagnostics: ServiceAppRemovalDiagnostic[] = [];

  constructor(
    private readonly params: {
      appHomeDirectory?: string;
      configManager: ConfigManager;
      runtimeService?: ServiceAppRuntime;
      listPackageComponentSources?: () => Promise<AppPackageComponentSource[]>;
      assertDocumentAccess?: (appId: string, scopeId: string, mode: "read" | "read-write") => Promise<void>;
      capabilityGrantManager: CapabilityGrantManager;
      hasAgent?: (agentId: string) => boolean;
      providerManager?: LlmProviderRuntime;
      llmUsage?: Pick<LlmUsageManager, "observeProviderManager">;
      agentRunClient?: Pick<AgentRunClient, "startRun">;
      portableServiceRunnerPath?: string;
      verificationRecords?: VerificationRecordService;
      jobJournal?: ServiceAppJobJournalService;
      residentInbox?: ServiceAppResidentEventInboxService;
    },
  ) {
    this.residentInbox = params.residentInbox ?? new ServiceAppResidentEventInboxService();
    this.runtimeService =
      params.runtimeService ??
      new ServiceAppRuntimeService({
        getConfig: () => params.configManager.config,
        configPath: params.configManager.configPath,
        appHomeDirectory: params.appHomeDirectory,
        portableServiceRunnerPath: params.portableServiceRunnerPath,
        residentInbox: this.residentInbox,
      });
    this.recordService = new ServiceAppRecordService({
      getWorkspacePath: this.getWorkspacePath,
      runtimeService: this.runtimeService,
      listPackageComponentSources: this.listPackageComponentSources,
      listWorkspaceDirectoryNames: this.listServiceAppDirNames,
    });
    this.lifecycleService = new ServiceAppLifecycleService({
      recordService: this.recordService,
      runtimeService: this.runtimeService,
    });
    this.actionGrants = new ServiceActionGrantService({
      capabilityGrantManager: params.capabilityGrantManager,
      resolveAction: this.requireServiceAction,
    });
    this.aiCapabilities = new ServiceAppAiCapabilityService({
      capabilityGrantManager: params.capabilityGrantManager,
      hasAgent: params.hasAgent ?? (() => false),
      hasModel: (modelId) => hasConfiguredServiceModel(params.configManager.config, modelId),
      providerManager: params.providerManager,
      llmUsage: params.llmUsage,
      agentRunClient: params.agentRunClient,
    });
    this.aiManager = new ServiceAppAiManager({
      capabilities: this.aiCapabilities,
      records: this.recordService,
    });
    this.runtimeService.setPortableHostCallHandler?.(this.aiCapabilities.handlePortableHostCall);
    this.packageRuntime = new ServiceAppPackageRuntimeService({
      getStatus: this.runtimeService.getStatus,
      restore: async (serviceId) => {
        await this.discoverServiceAppActions(serviceId);
      },
      stop: this.runtimeService.stop,
    });
    this.verificationRecords = params.verificationRecords;
    this.jobJournal = params.jobJournal ?? new ServiceAppJobJournalService();
    this.jobManager = new ServiceAppJobManager({
      journal: this.jobJournal,
      residentInbox: this.residentInbox,
      runtime: this.runtimeService,
      verificationRecords: this.verificationRecords,
      requireServiceApp: this.recordService.require,
      listPackageComponentSources: this.listPackageComponentSources,
    });
    this.activationManager = new ServiceAppActivationManager({
      runtime: this.runtimeService,
      records: this.recordService,
      aiCapabilities: this.aiCapabilities,
      getWorkspaceServiceAppsPath: () => this.getServiceAppsPath(this.getWorkspacePath()),
      listWorkspaceDirectoryNames: this.listServiceAppDirNames,
      listPackageComponentSources: this.listPackageComponentSources,
    });
  }

  start = async (): Promise<void> => {
    this.reconciliationDiagnostics = await this.removalService.reconcile({
      capabilityGrantManager: this.params.capabilityGrantManager,
      lockPathForAppId: (appId) => this.getServiceAppLockPath(this.getWorkspacePath(), appId),
      serviceAppsPath: this.getServiceAppsPath(this.getWorkspacePath()),
    });
    const discovered = await this.recordService.listValid();
    const recoveredScopes = new Map<string, ServiceAppJobScope>();
    for (const { record } of discovered) {
      const scope = this.toJobScope(record);
      if (scope) recoveredScopes.set(scope.stateDirectory, scope);
    }
    await this.jobJournal.recoverUnfinished([...recoveredScopes.values()]);
    const ready = [] as typeof discovered;
    for (const registration of discovered) {
      try {
        await this.aiCapabilities.assertReady(registration.record, registration.manifest);
        ready.push(registration);
      } catch {
        // Required AI slots fail closed. The record remains inspectable and can
        // be bound through the management surfaces before the next start.
      }
    }
    await this.lifecycleService.startDiscovered(ready);
  };

  listServiceApps = async (): Promise<ServiceAppList> => {
    const workspacePath = this.getWorkspacePath();
    const serviceAppsPath = this.getServiceAppsPath(workspacePath);
    const dirNames = await this.listServiceAppDirNames(serviceAppsPath);
    const workspaceEntries = await Promise.all(dirNames.map((dirName) => this.recordService.buildWorkspaceRecord(serviceAppsPath, dirName)));
    const packageSources = (await this.listPackageComponentSources()).filter((component) => component.kind === "service");
    const packageEntries = await Promise.all(packageSources.map((source) => this.recordService.buildPackageRecord(source)));
    return {
      workspacePath,
      serviceAppsPath,
      diagnostics: this.reconciliationDiagnostics,
      entries: [...workspaceEntries, ...packageEntries].filter((entry): entry is ServiceAppRecord => Boolean(entry)).sort((left, right) => left.title.localeCompare(right.title)),
    };
  };

  listCapabilityProviders = async () => projectCapabilityProviders(await this.recordService.listValid());

  getServiceApp = async (appId: string): Promise<ServiceAppRecord> => {
    const { record } = await this.recordService.require(appId);
    return record;
  };

  inspectServiceAppAiCapabilities = async (appId: string) => await this.aiManager.inspect(appId);
  verifyServiceAppAiCapabilities = async (appId: string) => await this.aiManager.inspect(appId);
  bindServiceAppModelSlot = async (appId: string, slotId: string, modelId: string) => await this.aiManager.bindModel(appId, slotId, modelId);
  bindServiceAppAgentSlot = async (appId: string, slotId: string, agentId: string) => await this.aiManager.bindAgent(appId, slotId, agentId);
  unbindServiceAppAiSlot = async (appId: string, kind: "model" | "agent", slotId: string) => await this.aiManager.unbind(appId, kind, slotId);
  completeServiceAppModelSlot = async (params: Parameters<ServiceAppAiManager["completeModel"]>[0]) => await this.aiManager.completeModel(params);
  startServiceAppAgentSlot = async (params: Parameters<ServiceAppAiManager["startAgent"]>[0]) => await this.aiManager.startAgent(params);

  listServiceActions = async (
    params: {
      caller?: ServiceActionCaller;
      appId?: string;
      declaredActions?: readonly string[];
    } = {},
  ): Promise<ServiceAction[]> => {
    const manifests = params.appId ? [await this.recordService.require(params.appId)] : await this.recordService.listValid();
    const actions = manifests.flatMap(({ manifest, record }) => listServiceAppManifestActions(record, manifest));
    return await Promise.all(actions.map(async (action) => await this.withGrantState(action, params)));
  };

  discoverServiceAppActions = async (appId: string): Promise<ServiceAction[]> => {
    const { manifest, record } = await this.recordService.require(appId, true);
    const runtimeActions = await this.runtimeService.listActions({
      app: record,
      manifest,
    });
    return mergeServiceAppRuntimeActions({ record, manifest, runtimeActions });
  };

  invokeServiceAction = async (actionId: string, request: ServiceActionInvokeRequest): Promise<ServiceActionInvokeResult> => {
    assertServiceActionCaller(request.caller, this.params.hasAgent);
    assertServiceActionDeclared(request.caller, actionId, request.declaredActions);
    const { manifest, record } = await this.requireServiceAppForAction(actionId, true);
    const actionName = getServiceActionName(actionId, record.id);
    if (!Object.hasOwn(manifest.actions, actionName)) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    const action = listServiceAppManifestActions(record, manifest).find((entry) => entry.id === actionId);
    if (!action) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    if (!(await this.actionGrants.isGranted(request.caller, action))) {
      throw new ServiceAppError("AUTHORIZATION_REQUIRED", `This panel app needs permission to call ${actionId}.`);
    }
    await this.assertDocumentInputAccess(record, action.risk, request.input ?? {});
    return await this.jobManager.invoke({
      actionId,
      actionName,
      record,
      manifest,
      input: request.input ?? {},
      role: request.caller.surface === "agent" ? "agent" : "panel",
      entrySurface: request.caller.surface === "agent" ? "agent" : "panel",
    });
  };

  /**
   * Calls a Service component belonging to an enabled installed package.
   * This is deliberately separate from source-tree `nextclaw app call`.
   */
  invokeInstalledServiceAction = async (appId: string, actionName: string, input: Record<string, unknown> = {}): Promise<ServiceActionInvokeResult> => {
    const { manifest, record } = await this.requireInstalledServiceApp(appId, actionName);
    const action = listServiceAppManifestActions(record, manifest).find((entry) => entry.name === actionName);
    await this.assertDocumentInputAccess(record, action?.risk ?? "dangerous", input);
    return await this.jobManager.invoke({
      actionId: buildServiceActionId(record.id, actionName),
      actionName,
      record,
      manifest,
      input,
      role: "cli",
      entrySurface: "installed-app-cli",
    });
  };

  private assertDocumentInputAccess = async (record: ServiceAppRecord, risk: ServiceAction["risk"], input: Record<string, unknown>): Promise<void> => {
    const path = typeof input.path === "string" ? input.path : undefined;
    const match = path?.match(DOCUMENT_GUEST_PATH_PATTERN);
    if (!match || !record.packageId || !this.params.assertDocumentAccess) return;
    const scopeId = decodeURIComponent(match[1] as string);
    const requestedMode = risk === "read" ? "read" : "read-write";
    try {
      await this.params.assertDocumentAccess(record.packageId, scopeId, requestedMode);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "DOCUMENT_SCOPE_NOT_GRANTED";
      if (code === "DOCUMENT_SCOPE_NOT_GRANTED" || code === "DOCUMENT_SCOPE_MODE_INSUFFICIENT" || code === "DOCUMENT_SCOPE_UNAVAILABLE") {
        throw new ServiceAppError(code, error instanceof Error ? error.message : code, {
          appId: record.packageId,
          scopeId,
          requestedMode,
          recoveryActions: code === "DOCUMENT_SCOPE_UNAVAILABLE" ? ["replace", "revoke"] : code === "DOCUMENT_SCOPE_MODE_INSUFFICIENT" ? ["upgrade"] : ["grant"],
        });
      }
      throw error;
    }
  };

  listVerificationRecords = async (filters: { acceptanceId?: string; appId?: string; limit?: number } = {}) => await this.jobManager.listVerificationRecords(filters);
  exportVerificationRecords = async (filters: { acceptanceId?: string; appId?: string; limit?: number } = {}) => await this.jobManager.exportVerificationRecords(filters);
  listServiceAppJobs = async (appId: string, params: { caller?: ServiceAppJobCaller } = {}) => await this.jobManager.list(appId, params.caller);
  getServiceAppJob = async (appId: string, jobId: string, params: { caller?: ServiceAppJobCaller } = {}) => await this.jobManager.get(appId, jobId, params.caller);
  watchServiceAppJob = async (appId: string, jobId: string, afterSequence?: number, params: { caller?: ServiceAppJobCaller } = {}) => await this.jobManager.watch(appId, jobId, afterSequence, params.caller);
  cancelServiceAppJob = async (appId: string, jobId: string, params: { caller?: ServiceAppJobCaller } = {}) => await this.jobManager.cancel(appId, jobId, params.caller);
  listResidentInbox = async (appId: string, params: { deadLettersOnly?: boolean } = {}) => await this.jobManager.listResidentInbox(appId, params.deadLettersOnly);
  replayResidentDeadLetter = async (appId: string, eventId: string) => await this.jobManager.replayResidentDeadLetter(appId, eventId);
  enqueueResidentEvent = async (appId: string, input: ResidentEventInput) => await this.jobManager.enqueueResidentEvent(appId, input);
  createServiceAppJob = async (params: Parameters<ServiceAppJobManager["create"]>[0]) => await this.jobManager.create(params);
  createServiceAppJobEventSink = (record: ServiceAppRecord, jobId: string) => this.jobManager.createEventSink(record, jobId);

  grantServiceAction = async (actionId: string, request: ServiceActionGrantRequest): Promise<ServiceActionGrant> => {
    const [grant] = await this.grantServiceActions([actionId], request);
    if (!grant) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    return grant;
  };

  grantServiceActions = async (actionIds: readonly string[], request: ServiceActionGrantRequest): Promise<ServiceActionGrant[]> => {
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

  listServiceActionGrants = async (): Promise<ServiceActionGrant[]> => await this.actionGrants.list();

  revokeServiceAction = async (caller: ServiceActionCaller, actionId: string): Promise<void> => {
    assertServiceActionCaller(caller, this.params.hasAgent);
    await this.actionGrants.revoke(caller, actionId);
  };

  matchesCapabilityGrant = async (grant: CapabilityGrant): Promise<boolean> => {
    if ((grant.subject.type !== "panel-app" && grant.subject.type !== "agent") || grant.resource.type !== "service.action") {
      return false;
    }
    const actionId = readServiceActionTargetId(grant.resource.target);
    if (!actionId) return false;
    try {
      const action = await this.requireServiceAction(actionId);
      return (
        getCapabilityGrantKey(grant) ===
        getCapabilityGrantKey(createServiceActionGrantRequest(grant.subject.type === "panel-app" ? { surface: "panel-app", appId: grant.subject.id } : { surface: "agent", agentId: grant.subject.id }, action))
      );
    } catch {
      return false;
    }
  };

  restartServiceApp = async (appId: string): Promise<ServiceAppRecord> => {
    const { record } = await this.recordService.require(appId);
    await this.runtimeService.restart(record.id);
    return await this.getServiceApp(appId);
  };

  listWorkspaceDataOwners = async (): Promise<WorkspaceServiceDataOwner[]> =>
    await this.recordService.listWorkspaceDataOwners(this.getServiceAppsPath(this.getWorkspacePath()), await this.listServiceAppDirNames(this.getServiceAppsPath(this.getWorkspacePath())));

  deleteServiceApp = async (appId: string, purgeData = false): Promise<ServiceAppDeleteResult> => {
    if (!SERVICE_APP_ID_PATTERN.test(appId)) {
      throw new ServiceAppError("SERVICE_APP_INVALID_MANIFEST", "service app id must use kebab-case");
    }
    const workspacePath = this.getWorkspacePath();
    let record: ServiceAppRecord;
    try {
      record = await this.removalService.remove({
        capabilityGrantManager: this.params.capabilityGrantManager,
        lockPath: this.getServiceAppLockPath(workspacePath, appId),
        purgeData,
        loadRecord: async () => {
          const { record } = await this.recordService.require(appId);
          if (record.sourceKind === "package") {
            throw new ServiceAppError("SERVICE_APP_MANAGED_SOURCE", `package service must be managed through Apps: ${record.packageId}`);
          }
          return record;
        },
        stopRuntime: async (loaded) => await this.runtimeService.stop(loaded.id),
      });
    } catch (error) {
      if (error instanceof ServiceAppRemovalCleanupError) {
        throw new ServiceAppError("SERVICE_APP_RUNTIME_FAILED", `Service App ${appId} 已从 workspace 移除，但${error.message}`);
      }
      throw error;
    }
    return { deleted: true, id: record.id, dataRemoved: purgeData };
  };

  dispose = async (): Promise<void> => await this.runtimeService.dispose();

  assertCanActivatePackageComponents = async (components: AppPackageComponentSource[]): Promise<void> => await this.activationManager.assertCanActivate(components);

  activatePackageComponents = async (components: AppPackageComponentSource[]): Promise<void> => await this.lifecycleService.activatePackageComponents(components);

  deactivatePackageComponents = async (components: AppPackageComponentSource[]): Promise<void> => await this.lifecycleService.deactivatePackageComponents(components);

  preparePackageComponentDeactivation = async (components: AppPackageComponentSource[]): Promise<() => Promise<void>> => await this.packageRuntime.prepareDeactivation(components);

  removePackageComponentGrants = async (components: AppPackageComponentSource[]): Promise<() => Promise<void>> =>
    await this.actionGrants.removePackageGrants(new Set(components.filter((component) => component.kind === "service").map((component) => component.id)));

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
    const action = listServiceAppManifestActions(record, manifest).find((entry) => entry.id === actionId);
    if (!action) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "service action not found");
    }
    return action;
  };

  private requireServiceAppForAction = async (actionId: string, materializeStorage = false): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const appId = actionId.split(".")[0]?.trim();
    if (!appId) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", "service action id is invalid");
    }
    return await this.recordService.require(appId, materializeStorage);
  };

  private requireInstalledServiceApp = async (appId: string, actionName: string): Promise<{ manifest: ServiceAppManifest; record: ServiceAppRecord }> => {
    const candidates = await Promise.all(
      (await this.listPackageComponentSources())
        .filter((component) => component.kind === "service" && component.packageId === appId)
        .map(async (component) => {
          const manifest = await readServiceAppManifest(component.sourcePath);
          return Object.hasOwn(manifest.actions, actionName)
            ? {
                manifest,
                record: this.recordService.fromManifest(component.sourcePath, manifest, component, component.storage),
              }
            : null;
        }),
    );
    const matching = candidates.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    if (matching.length === 0) {
      throw new ServiceAppError("SERVICE_APP_ACTION_NOT_FOUND", "installed App action not found");
    }
    if (matching.length > 1) {
      throw new ServiceAppError("SERVICE_APP_INVALID_ACTION", `installed App ${appId} exposes action ${actionName} from multiple Service components`);
    }
    return matching[0]!;
  };

  private normalizeActionIds = (actionIds: readonly string[]): string[] => Array.from(new Set(actionIds.map((actionId) => actionId.trim()).filter((actionId) => actionId.length > 0)));

  private toJobScope = (record: ServiceAppRecord): ServiceAppJobScope | undefined =>
    record.storage?.stateDirectory && record.instanceId
      ? {
          appId: record.packageId ?? record.id,
          instanceId: record.instanceId,
          stateDirectory: record.storage.stateDirectory,
        }
      : undefined;

  private getWorkspacePath = (): string => getWorkspacePathFromConfig(this.params.configManager.config);

  private getServiceAppsPath = (workspacePath: string): string => join(workspacePath, DEFAULT_SERVICE_APPS_DIR);

  private getServiceAppLockPath = (workspacePath: string, appId: string): string => join(workspacePath, ".nextclaw", "locks", "service-apps", `${appId}.lock`);

  private listPackageComponentSources = async (): Promise<AppPackageComponentSource[]> => (await this.params.listPackageComponentSources?.()) ?? [];

  private listServiceAppDirNames = async (serviceAppsPath: string): Promise<string[]> => {
    try {
      return await this.removalService.listCanonicalDirectoryNames(serviceAppsPath);
    } catch (error) {
      throw new ServiceAppError("SERVICE_APP_READ_FAILED", error instanceof Error ? error.message : String(error));
    }
  };

  private isMissingFileError = (error: unknown): boolean => typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";
}

type ServiceAppRuntime = Pick<ServiceAppRuntimeService, "dispose" | "getLastObservation" | "getStatus" | "invokeAction" | "listActions" | "restart" | "stop"> &
  Pick<Partial<ServiceAppRuntimeService>, "start"> & {
    cancelJob?: (params: { appId: string; instanceId: string; jobId: string }) => Promise<void>;
    enqueueResidentEvent?: ServiceAppRuntimeService["enqueueResidentEvent"];
    setPortableHostCallHandler?: ServiceAppRuntimeService["setPortableHostCallHandler"];
  };
