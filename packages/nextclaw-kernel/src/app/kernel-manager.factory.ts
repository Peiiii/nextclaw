import { AppDataManager } from "@kernel/managers/app-data.manager.js";
import type { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ChannelManager } from "@kernel/managers/channel.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import type { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import type { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ObservationManager } from "@kernel/features/observation/index.js";
import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { ProjectManager } from "@kernel/managers/project.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  getDataDir,
  getWorkspacePathFromConfig,
  type DiagnosticRuntime,
  type MessageBus,
  SessionSearchService,
} from "@nextclaw/core";
import type { EventBus, Ingress } from "@nextclaw/shared";
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
}): {
  appDataManager: AppDataManager;
  serviceAppManager: ServiceAppManager;
} {
  const { appHomeDirectory, appPackageManager, configManager } = params;
  const serviceAppManager = new ServiceAppManager({
    configManager,
    listPackageComponentSources: appPackageManager.listActiveComponentSources,
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

export function createKernelSessionManagers(params: {
  agentContextWindowManager: AgentContextWindowManager;
  agentManager: AgentManager;
  configManager: ConfigManager;
  eventBus: EventBus;
  ingress: Ingress;
  observationStorePath: string;
  projectStorePath: string;
  sessionsDir: string;
}): {
  journalStore: NcpAgentSessionJournalStore;
  observations: ObservationManager;
  projectManager: ProjectManager;
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
    projectStorePath,
    sessionsDir,
  } = params;
  const sessionSearch = new SessionSearchService({
    databasePath: resolve(getDataDir(), "session-search.db"),
    sessionsDir,
  });
  const journalStore = new NcpAgentSessionJournalStore(
    resolve(sessionsDir, ".ncp-agent-journal"),
  );
  const projectManager = new ProjectManager({
    storePath: projectStorePath,
    getDefaultWorkspacePath: () =>
      getWorkspacePathFromConfig(configManager.config),
  });
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
  observationOwner.current = observations;
  return {
    journalStore,
    observations,
    projectManager,
    sessionManager,
    sessionSearch,
  };
}
