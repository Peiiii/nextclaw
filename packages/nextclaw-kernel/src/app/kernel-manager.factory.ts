import { AppDataManager } from "@kernel/managers/app-data.manager.js";
import type { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ChannelManager } from "@kernel/managers/channel.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import type { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import type { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import type { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import type { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import type { VerificationRecordService } from "@kernel/services/verification-record.service.js";
import { VerificationRecordService as VerificationRecordServiceImpl } from "@kernel/services/verification-record.service.js";
import { PortableRuntimeAcceptanceIdentityService } from "@kernel/services/portable-runtime-acceptance-identity.service.js";
import { PortableRuntimeAcceptanceManager } from "@kernel/services/portable-runtime-acceptance-manager.service.js";
import type { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ObservationManager } from "@kernel/features/observation/index.js";
import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import {
  ProjectManager,
  ProjectMaterialService,
  ProjectWorkManager,
} from "@kernel/features/projects/index.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  getDataDir,
  getWorkspacePathFromConfig,
  type DiagnosticRuntime,
  type MessageBus,
  SessionSearchService,
} from "@nextclaw/core";
import type { EventBus, Ingress } from "@nextclaw/shared";
import type { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import { AgentRunRuntimeContribution } from "@kernel/contributions/agent-run-runtime/index.js";
import { ContextProviderContribution } from "@kernel/contributions/context-provider/index.js";
import { ContextWindowContribution } from "@kernel/contributions/context-window/index.js";
import { LearningLoopContribution } from "@kernel/contributions/learning-loop/index.js";
import { ToolProviderContribution } from "@kernel/contributions/tool-provider/index.js";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { resolve } from "node:path";

export function createKernelOperationalManagers(params: {
  automationStorePath: string;
  configPath?: string;
  diagnostics: DiagnosticRuntime;
  messageBus: MessageBus;
  providerManager: LlmProviderManager;
  providerModelCatalogManager: ProviderModelCatalogManager;
}): {
  automation: AutomationManager;
  channels: ChannelManager;
  configManager: ConfigManager;
} {
  const {
    automationStorePath,
    configPath,
    diagnostics,
    messageBus,
    providerManager,
    providerModelCatalogManager,
  } = params;
  const channels = new ChannelManager({
    bus: messageBus,
    diagnostics,
  });
  return {
    automation: new AutomationManager({
      storePath: automationStorePath,
      diagnostics,
    }),
    channels,
    configManager: new ConfigManager({
      configPath,
      channels,
      diagnostics,
      providerManager,
      providerModelCatalogManager,
    }),
  };
}

export function createKernelServiceAppManagers(params: {
  appHomeDirectory: string;
  appPackageManager: AppPackageManager;
  configManager: ConfigManager;
  capabilityGrantManager: CapabilityGrantManager;
  hasAgent?: (agentId: string) => boolean;
  providerManager?: LlmProviderManager;
  llmUsage?: LlmUsageManager;
  agentRunClient?: AgentRunClient;
  portableServiceRunnerPath?: string;
  verificationRecords?: VerificationRecordService;
}): {
  appDataManager: AppDataManager;
  serviceAppManager: ServiceAppManager;
} {
  const {
    appHomeDirectory,
    appPackageManager,
    capabilityGrantManager,
    configManager,
    hasAgent,
    providerManager,
    llmUsage,
    agentRunClient,
    portableServiceRunnerPath,
    verificationRecords,
  } = params;
  const serviceAppManager = new ServiceAppManager({
    appHomeDirectory,
    configManager,
    listPackageComponentSources: appPackageManager.listActiveComponentSources,
    assertDocumentAccess: appPackageManager.assertDocumentAccess,
    capabilityGrantManager,
    hasAgent,
    providerManager,
    llmUsage,
    agentRunClient,
    portableServiceRunnerPath,
    verificationRecords,
  });
  return {
    serviceAppManager,
    appDataManager: new AppDataManager({
      appHomeDirectory,
      getWorkspacePath: () => getWorkspacePathFromConfig(configManager.config),
      listInstalledPackageOwners: appPackageManager.listInstalledDataOwners,
      listWorkspaceDataOwners: serviceAppManager.listWorkspaceDataOwners,
    }),
  };
}

/** Composes the installed-App runtime owners without growing the Kernel shell. */
export function createKernelAppRuntimeManagers(params: {
  appHomeDirectory: string;
  appPackageManager: AppPackageManager;
  panelAppManager: PanelAppManager;
  configManager: ConfigManager;
  capabilityGrantManager: CapabilityGrantManager;
  hasAgent?: (agentId: string) => boolean;
  providerManager?: LlmProviderManager;
  llmUsage?: LlmUsageManager;
  agentRunClient?: AgentRunClient;
  portableServiceRunnerPath?: string;
  verificationRecords?: VerificationRecordService;
}): {
  appDataManager: AppDataManager;
  serviceAppManager: ServiceAppManager;
} {
  const managers = createKernelServiceAppManagers(params);
  installKernelAppPackageRuntimeHooks({
    appPackageManager: params.appPackageManager,
    panelAppManager: params.panelAppManager,
    serviceAppManager: managers.serviceAppManager,
  });
  return managers;
}

/**
 * Keeps current-runtime identity and acceptance projection independent from
 * the Service App manager while allowing ordinary invocation records to carry
 * Kernel-owned `local` provenance.
 */
export function createPortableRuntimeAcceptanceServices(params: {
  productVersion?: string;
  runtimeVersion?: string;
  portableServiceRunnerPath?: string;
  verificationRecordStorePath: string;
}): {
  verificationRecords: VerificationRecordService;
  portableRuntimeAcceptance: PortableRuntimeAcceptanceManager;
} {
  const {
    productVersion,
    runtimeVersion,
    portableServiceRunnerPath,
    verificationRecordStorePath,
  } = params;
  const identity = new PortableRuntimeAcceptanceIdentityService({
    productVersion,
    runtimeVersion,
    portableServiceRunnerPath,
  });
  const verificationRecords = new VerificationRecordServiceImpl({
    storePath: verificationRecordStorePath,
    resolveCurrentIdentity: async (appId) => {
      const resolved = await identity.resolve(appId);
      return resolved.available ? resolved.context : undefined;
    },
  });
  return {
    verificationRecords,
    portableRuntimeAcceptance: new PortableRuntimeAcceptanceManager({
      verificationRecords,
      identity,
    }),
  };
}

export function createKernelSessionManagers(params: {
  agentContextWindowManager: AgentContextWindowManager;
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  ingress: Ingress;
  observationStorePath: string;
  legacyProjectStorePath: string;
  projectDatabasePath: string;
  sessionsDir: string;
}): {
  journalStore: NcpAgentSessionJournalStore;
  observations: ObservationManager;
  projectManager: ProjectManager;
  projectMaterials: ProjectMaterialService;
  projectWorkManager: ProjectWorkManager;
  sessionManager: SessionManager;
  sessionSearch: SessionSearchService;
} {
  const {
    agentContextWindowManager,
    agentManager,
    configManager,
    eventBus,
    ingress,
    observationStorePath,
    legacyProjectStorePath,
    projectDatabasePath,
    sessionsDir,
  } = params;
  const sessionSearch = new SessionSearchService({
    databasePath: resolve(getDataDir(), "session-search.db"),
    sessionsDir,
  });
  const journalStore = new NcpAgentSessionJournalStore(
    resolve(sessionsDir, ".ncp-agent-journal"),
  );
  const projectWorkOwner: { current: ProjectWorkManager | null } = {
    current: null,
  };
  const projectManager = new ProjectManager({
    databasePath: projectDatabasePath,
    legacyStorePath: legacyProjectStorePath,
    getDefaultWorkspacePath: () =>
      getWorkspacePathFromConfig(configManager.config),
    onProjectRegistered: async (project) => {
      await projectWorkOwner.current?.ensureProject(project.id);
    },
  });
  const projectWorkManager = new ProjectWorkManager({
    databasePath: projectDatabasePath,
    eventBus,
    projectManager,
  });
  projectWorkOwner.current = projectWorkManager;
  const observationOwner: { current: ObservationManager | null } = {
    current: null,
  };
  const sessionManager = new SessionManager({
    agentContextWindowManager,
    agentManager,
    configManager,
    eventBus,
    journalStore,
    projectManager,
    sessionSearch,
    beforeDeleteSession: async (sessionId) => {
      if (!observationOwner.current) {
        throw new Error("Observation manager is not initialized.");
      }
      await observationOwner.current.removeSession(sessionId);
    },
  });
  const observations = new ObservationManager({
    storePath: observationStorePath,
    sessionManager,
    agentManager,
    ingress,
    eventBus,
  });
  const projectMaterials = new ProjectMaterialService({
    projectManager,
  });
  observationOwner.current = observations;
  return {
    journalStore,
    observations,
    projectManager,
    projectMaterials,
    projectWorkManager,
    sessionManager,
    sessionSearch,
  };
}

export function createKernelContributions(
  kernel: NextclawKernel,
): KernelContribution[] {
  return [
    new ToolProviderContribution(kernel),
    new LearningLoopContribution(kernel),
    new ContextProviderContribution(kernel),
    new AgentRunRuntimeContribution(kernel),
    new ContextWindowContribution(kernel),
  ];
}

export function installKernelAppPackageRuntimeHooks(params: {
  appPackageManager: AppPackageManager;
  panelAppManager: PanelAppManager;
  serviceAppManager: ServiceAppManager;
}): void {
  const { appPackageManager, panelAppManager, serviceAppManager } = params;
  appPackageManager.installRuntimeHooks({
    listCapabilityProviders: serviceAppManager.listCapabilityProviders,
    assertCanActivate: async (sources) => {
      await panelAppManager.assertCanActivatePackageComponents(sources);
      await serviceAppManager.assertCanActivatePackageComponents(sources);
    },
    afterActivate: async (sources) => {
      await serviceAppManager.activatePackageComponents(sources);
    },
    beforeDeactivate: async (sources) => {
      panelAppManager.deactivatePackageComponents(sources);
      await serviceAppManager.deactivatePackageComponents(sources);
    },
    prepareCapabilityChange: async (sources) =>
      await serviceAppManager.preparePackageComponentDeactivation(sources),
    afterCapabilityChange: async (sources) => {
      await serviceAppManager.activatePackageComponents(sources);
    },
    beforeUninstall: async (sources) => {
      const rollbacks: Array<() => Promise<void>> = [];
      try {
        rollbacks.push(
          panelAppManager.preparePackageComponentDeactivation(sources),
        );
        rollbacks.push(
          await serviceAppManager.preparePackageComponentDeactivation(sources),
        );
        rollbacks.push(
          await panelAppManager.removePackageComponentState(sources),
        );
        rollbacks.push(
          await serviceAppManager.removePackageComponentGrants(sources),
        );
      } catch (error) {
        const recoveryErrors = await runAppPackageRollbacks(rollbacks);
        if (recoveryErrors.length > 0) {
          throw new AggregateError(
            [error, ...recoveryErrors],
            "应用卸载准备失败，且 runtime、授权或 Panel 状态恢复未完整完成。",
          );
        }
        throw error;
      }
      return async () => {
        const recoveryErrors = await runAppPackageRollbacks(rollbacks);
        if (recoveryErrors.length > 0) {
          throw new AggregateError(
            recoveryErrors,
            "应用卸载后的 runtime、授权或 Panel 状态恢复未完整完成。",
          );
        }
      };
    },
  });
}

async function runAppPackageRollbacks(
  rollbacks: Array<() => Promise<void>>,
): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const rollback of [...rollbacks].reverse()) {
    try {
      await rollback();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}
