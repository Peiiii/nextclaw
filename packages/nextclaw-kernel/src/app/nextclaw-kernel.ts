import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { AccessManager } from "@kernel/managers/access.manager.js";
import type { AutomationManager } from "@kernel/managers/automation.manager.js";
import { AppPackageManager } from "@kernel/managers/app-package.manager.js";
import type { AppDataManager } from "@kernel/managers/app-data.manager.js";
import type { ChannelManager } from "@kernel/managers/channel.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { ContextProviderManager } from "@kernel/managers/context-provider.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { ProviderModelCatalogManager } from "@kernel/managers/provider-model-catalog.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import {
  createCronJobSystemObjectProvider,
  createInboxDeliverySystemObjectProvider,
  SystemObjectReferenceManager,
} from "@kernel/managers/system-object-reference.manager.js";
import { McpManager } from "@kernel/managers/mcp.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import { SessionContextCompactionManager } from "@kernel/managers/session-context-compaction.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import { PreferenceManager } from "@kernel/managers/preference.manager.js";
import type { ProjectManager } from "@kernel/managers/project.manager.js";
import type { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { ToolProviderManager } from "@kernel/managers/tool-provider.manager.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  createAgentRuntimeSessionRequestDispatcher,
  SessionRequestManager,
} from "@kernel/features/session-request/index.js";
import { AgentRunRuntimeContribution } from "@kernel/contributions/agent-run-runtime/index.js";
import { ContextProviderContribution } from "@kernel/contributions/context-provider/index.js";
import { ContextWindowContribution } from "@kernel/contributions/context-window/index.js";
import { LearningLoopContribution } from "@kernel/contributions/learning-loop/index.js";
import { ToolProviderContribution } from "@kernel/contributions/tool-provider/index.js";
import type { AgentRuntimeSessionTypeDescribeParams } from "@kernel/features/runtime-registry/index.js";
import type { ObservationManager } from "@kernel/features/observation/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  type GatewayController,
  getDataDir,
  getWorkspacePath,
  MessageBus,
  DiagnosticRuntime,
  type SessionSearchService,
} from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { resolve } from "node:path";
import { readProjectRoot } from "@kernel/utils/session-creation.utils.js";
import {
  resolveKernelAppHomeDirectory,
  resolveKernelAutomationStorePath,
  resolveKernelInboxDeliveryStorePath,
  resolveKernelObservationStorePath,
  resolveKernelPreferenceStorePath,
  resolveKernelProjectStorePath,
  resolveKernelSessionsDir,
} from "@kernel/app/kernel-storage-paths.js";
import {
  createKernelOperationalManagers,
  createKernelSessionManagers,
  createKernelServiceAppManagers,
} from "@kernel/app/kernel-manager.factory.js";
import type { ProductActivitySink } from "@kernel/types/product-activity.types.js";

export type NextclawKernelOptions = {
  homeDir?: string;
  configPath?: string;
  builtInAppsDirectory?: string;
  productVersion?: string;
  productActivitySink?: ProductActivitySink;
};

type NextclawKernelRuntimeControl<TGatewayInput, TUiInput, TStartInput> = {
  gateway: (input: TGatewayInput) => Promise<void>;
  ui: (input: TUiInput) => Promise<void>;
  start: (input: TStartInput) => Promise<void>;
  restart: (input: TStartInput) => Promise<void>;
  serve: (input: TStartInput) => Promise<void>;
  stop: () => Promise<void>;
};

class NextclawKernelControlManager<TGatewayInput, TUiInput, TStartInput> {
  private runtimeControl: NextclawKernelRuntimeControl<
    TGatewayInput,
    TUiInput,
    TStartInput
  > | null = null;

  installRuntimeControl = (
    runtimeControl: NextclawKernelRuntimeControl<
      TGatewayInput,
      TUiInput,
      TStartInput
    >,
  ) => {
    this.runtimeControl = runtimeControl;
  };

  requireRuntimeControl = () => {
    if (!this.runtimeControl) {
      throw new Error("Kernel runtime control is not installed.");
    }
    return this.runtimeControl;
  };
}

export class NextclawKernel {
  readonly eventBus: EventBus = new EventBus();
  readonly ingress: Ingress = new Ingress();
  readonly messageBus: MessageBus = new MessageBus();
  readonly diagnostics = new DiagnosticRuntime();
  readonly llmProviders: LlmProviderManager = new LlmProviderManager();
  readonly providerModelCatalog = new ProviderModelCatalogManager(
    this.llmProviders,
  );
  readonly llmUsage: LlmUsageManager = new LlmUsageManager();
  readonly configManager: ConfigManager;
  readonly accessManager: AccessManager;
  readonly agents: AgentManager;
  readonly control: NextclawKernelControlManager<unknown, unknown, unknown>;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly appPackageManager: AppPackageManager;
  readonly appDataManager: AppDataManager;
  readonly channels: ChannelManager;
  readonly sessionRequests: SessionRequestManager;
  readonly sessionSearch: SessionSearchService;
  readonly assetStore: LocalAssetStore;
  readonly mcpManager: McpManager;
  readonly sessionManager: SessionManager;
  readonly inboxDeliveryManager: InboxDeliveryManager;
  readonly systemObjectReferenceManager: SystemObjectReferenceManager;
  readonly panelAppManager: PanelAppManager;
  readonly preferenceManager: PreferenceManager;
  readonly projectManager: ProjectManager;
  readonly serviceAppManager: ServiceAppManager;
  readonly extensions: ExtensionManager;
  readonly agentRuntimeManager = new AgentRuntimeManager();
  readonly agentContextWindowManager: AgentContextWindowManager;
  readonly contextCompactionManager: AgentRunContextCompactionManager;
  readonly contextProviderManager = new ContextProviderManager();
  readonly sessionRunManager: SessionRunManager;
  readonly sessionContextCompactionManager: SessionContextCompactionManager;
  readonly toolProviderManager = new ToolProviderManager(this.diagnostics);
  readonly agentRunRequestManager: AgentRunRequestManager;
  readonly observations: ObservationManager;
  private readonly ncpAgentSessionJournalStore: NcpAgentSessionJournalStore;
  private readonly contributions: KernelContribution[];
  private gatewayController: GatewayController | undefined;

  constructor(options: NextclawKernelOptions = {}) {
    const sessionsDir = resolveKernelSessionsDir(options);
    ({
      automation: this.automation,
      channels: this.channels,
      configManager: this.configManager,
    } = createKernelOperationalManagers({
      automationStorePath: resolveKernelAutomationStorePath(options),
      configPath: options.configPath,
      diagnostics: this.diagnostics,
      messageBus: this.messageBus,
      providerManager: this.llmProviders,
      providerModelCatalogManager: this.providerModelCatalog,
    }));
    this.assetStore = new LocalAssetStore({
      rootDir: resolve(getDataDir(), "assets"),
    });
    this.control = new NextclawKernelControlManager<
      unknown,
      unknown,
      unknown
    >();
    this.agents = new AgentManager(this.configManager);
    this.agentContextWindowManager = new AgentContextWindowManager(
      this.agents,
      this.contextProviderManager,
      this.toolProviderManager,
    );
    this.accessManager = new AccessManager({
      configManager: this.configManager,
      homeDir: options.homeDir,
    });
    ({
      journalStore: this.ncpAgentSessionJournalStore,
      observations: this.observations,
      projectManager: this.projectManager,
      sessionManager: this.sessionManager,
      sessionSearch: this.sessionSearch,
    } = createKernelSessionManagers({
      agentContextWindowManager: this.agentContextWindowManager,
      agentManager: this.agents,
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      observationStorePath: resolveKernelObservationStorePath(options),
      projectStorePath: resolveKernelProjectStorePath(options),
      sessionsDir,
    }));
    this.inboxDeliveryManager = new InboxDeliveryManager({
      eventBus: this.eventBus,
      storePath: resolveKernelInboxDeliveryStorePath(options),
    });
    this.systemObjectReferenceManager = new SystemObjectReferenceManager(
      this.assetStore,
      [
        createInboxDeliverySystemObjectProvider(this.inboxDeliveryManager),
        createCronJobSystemObjectProvider(this.automation),
      ],
    );
    this.appPackageManager = new AppPackageManager({
      appHomeDirectory: resolveKernelAppHomeDirectory(options),
      builtInAppsDirectory: options.builtInAppsDirectory,
      productVersion: options.productVersion,
    });
    this.panelAppManager = new PanelAppManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      listPackageComponentSources:
        this.appPackageManager.listActiveComponentSources,
    });
    this.preferenceManager = new PreferenceManager({
      storePath: resolveKernelPreferenceStorePath(options),
    });
    ({
      appDataManager: this.appDataManager,
      serviceAppManager: this.serviceAppManager,
    } = createKernelServiceAppManagers({
      appHomeDirectory: resolveKernelAppHomeDirectory(options),
      appPackageManager: this.appPackageManager,
      configManager: this.configManager,
    }));
    this.installAppPackageRuntimeHooks();
    this.extensions = new ExtensionManager({
      diagnostics: this.diagnostics,
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      messageBus: this.messageBus,
      sessionManager: this.sessionManager,
      observations: this.observations,
    });
    this.skills = new SkillManager({
      workspace: getWorkspacePath(
        this.configManager.config.agents.defaults.workspace,
      ),
    });
    this.mcpManager = new McpManager(this.configManager.loadConfig);
    this.configManager.installRuntimeHooks({
      resolveChannelConfig: this.extensions.toConfigView,
      getExtensionChannels: () =>
        this.extensions.getExtensionRegistry().channels,
      reloadExtensions: async ({ config, changedPaths }) => {
        await this.extensions.reloadForConfigChange({
          config,
          changedPaths,
        });
      },
      reloadMcp: async ({ config }) =>
        await this.mcpManager.applyConfig(config),
    });
    this.sessionRequests = new SessionRequestManager({
      sessionManager: this.sessionManager,
      dispatcher: createAgentRuntimeSessionRequestDispatcher({
        eventBus: this.eventBus,
        ingress: this.ingress,
      }),
    });
    this.contextCompactionManager = new AgentRunContextCompactionManager(
      this.agents,
      this.llmProviders,
    );
    this.sessionRunManager = new SessionRunManager(
      this.sessionManager,
      options.productActivitySink,
    );
    this.sessionContextCompactionManager = new SessionContextCompactionManager(
      this.agentRuntimeManager,
      this.eventBus,
      this.sessionManager,
      this.sessionRunManager,
    );
    this.agentRunRequestManager = new AgentRunRequestManager(
      this.agentRuntimeManager,
      this.agents,
      this.configManager,
      this.agentContextWindowManager,
      this.eventBus,
      this.ingress,
      this.sessionManager,
      this.sessionRunManager,
      this.diagnostics,
    );
    this.contributions = this.createContributions();
  }

  private createContributions = (): KernelContribution[] => [
    new ToolProviderContribution(this),
    new LearningLoopContribution(this),
    new ContextProviderContribution(this),
    new AgentRunRuntimeContribution(this),
    new ContextWindowContribution(this),
  ];

  private installAppPackageRuntimeHooks = (): void => {
    this.appPackageManager.installRuntimeHooks({
      assertCanActivate: async (sources) => {
        await this.panelAppManager.assertCanActivatePackageComponents(sources);
        await this.serviceAppManager.assertCanActivatePackageComponents(
          sources,
        );
      },
      beforeDeactivate: async (sources) => {
        this.panelAppManager.deactivatePackageComponents(sources);
        await this.serviceAppManager.deactivatePackageComponents(sources);
      },
      beforeUninstall: async (sources) => {
        await this.panelAppManager.removePackageComponentState(sources);
        await this.serviceAppManager.removePackageComponentGrants(sources);
      },
    });
  };

  listSessionTypes = (params?: AgentRuntimeSessionTypeDescribeParams) =>
    this.agentRuntimeManager.listSessionTypes(params);

  isSessionRunning = (sessionId: string): boolean =>
    this.sessionRunManager.isSessionRunning(sessionId);

  provideGatewayController = (gatewayController: GatewayController): void => {
    this.gatewayController = gatewayController;
  };

  getGatewayController = (): GatewayController | undefined =>
    this.gatewayController;

  start = async (): Promise<void> => {
    await this.ncpAgentSessionJournalStore.start();
    try {
      await this.appPackageManager.start();
      await this.appDataManager.start();
      await this.serviceAppManager.start();
      void this.sessionSearch.start();
      this.mcpManager.start();
      this.providerModelCatalog.start();
      await this.projectManager.importSessionProjects(
        (await this.sessionManager.listSessions()).map((session) =>
          readProjectRoot(session.metadata),
        ),
      );
      await this.sessionManager.start();
      for (const contribution of this.contributions) {
        await contribution.start();
      }
      this.agentRunRequestManager.start();
      await this.observations.start();
    } catch (error) {
      await this.ncpAgentSessionJournalStore.dispose();
      throw error;
    }
  };

  dispose = async (): Promise<void> => {
    try {
      this.providerModelCatalog.dispose();
      await this.observations.dispose();
      this.agentRunRequestManager.dispose();
      for (const contribution of [...this.contributions].reverse()) {
        await contribution.dispose();
      }
      this.toolProviderManager.dispose();
      this.contextProviderManager.dispose();
      await this.agentRuntimeManager.dispose();
      this.sessionRunManager.dispose();
      this.sessionManager.dispose();
      await this.mcpManager.dispose();
      await this.serviceAppManager.dispose();
      await this.sessionSearch.dispose();
    } finally {
      await this.ncpAgentSessionJournalStore.dispose();
    }
  };
}
