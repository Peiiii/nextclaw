import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { AccessManager } from "@kernel/managers/access.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ContextProviderManager } from "@kernel/managers/context-provider.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { McpManager } from "@kernel/managers/mcp.manager.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import { ServiceAppManager } from "@kernel/managers/service-app.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { ToolProviderManager } from "@kernel/managers/tool-provider.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  createAgentRuntimeSessionRequestDispatcher,
  SessionRequestManager,
} from "@kernel/features/session-request/index.js";
import { AgentRunRuntimeContribution } from "@kernel/contributions/agent-run-runtime/index.js";
import { ContextProviderContribution } from "@kernel/contributions/context-provider/index.js";
import { ContextWindowContribution } from "@kernel/contributions/context-window/index.js";
import { LearningLoopContribution } from "@kernel/contributions/learning-loop/index.js";
import { SessionActivityPreviewContribution } from "@kernel/contributions/session-activity-preview/index.js";
import { ToolProviderContribution } from "@kernel/contributions/tool-provider/index.js";
import type { AgentRuntimeSessionTypeDescribeParams } from "@kernel/features/runtime-registry/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  ChannelManager,
  ensureDir,
  expandHome,
  type GatewayController,
  getDataDir,
  getSessionsPath,
  getWorkspacePath,
  MessageBus,
  SessionSearchManager,
} from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { resolve } from "node:path";

export type NextclawKernelOptions = {
  homeDir?: string;
  configPath?: string;
};

function resolveKernelSessionsDir(options: NextclawKernelOptions): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return ensureDir(resolve(expandHome(homeDir), "sessions"));
  }
  return getSessionsPath();
}

function resolveKernelAutomationStorePath(
  options: NextclawKernelOptions,
): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return resolve(expandHome(homeDir), "cron", "jobs.json");
  }
  return resolve(getDataDir(), "cron", "jobs.json");
}

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
  readonly llmProviders: LlmProviderManager = new LlmProviderManager();
  readonly llmUsage: LlmUsageManager = new LlmUsageManager();
  readonly configManager: ConfigManager;
  readonly accessManager: AccessManager;
  readonly agents: AgentManager;
  readonly control: NextclawKernelControlManager<unknown, unknown, unknown>;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly channels: ChannelManager;
  readonly sessionRequests: SessionRequestManager;
  readonly sessionSearch: SessionSearchManager;
  readonly assetStore: LocalAssetStore;
  readonly mcpManager: McpManager;
  readonly sessionManager: SessionManager;
  readonly panelAppManager: PanelAppManager;
  readonly serviceAppManager: ServiceAppManager;
  readonly extensions: ExtensionManager;
  readonly agentRuntimeManager = new AgentRuntimeManager();
  readonly contextCompactionManager: AgentRunContextCompactionManager;
  readonly contextProviderManager = new ContextProviderManager();
  readonly sessionRunManager: SessionRunManager;
  readonly toolProviderManager = new ToolProviderManager();
  readonly agentRunRequestManager: AgentRunRequestManager;
  private readonly ncpAgentSessionJournalStore: NcpAgentSessionJournalStore;
  private readonly contributions: KernelContribution[];
  private gatewayController: GatewayController | undefined;

  constructor(options: NextclawKernelOptions = {}) {
    const sessionsDir = resolveKernelSessionsDir(options);
    this.sessionSearch = new SessionSearchManager({
      databasePath: resolve(getDataDir(), "session-search.db"),
      sessionsDir,
    });
    this.ncpAgentSessionJournalStore = new NcpAgentSessionJournalStore(
      resolve(sessionsDir, ".ncp-agent-journal"),
    );
    this.automation = new AutomationManager({
      storePath: resolveKernelAutomationStorePath(options),
    });
    this.assetStore = new LocalAssetStore({
      rootDir: resolve(getDataDir(), "assets"),
    });
    this.agents = new AgentManager();
    this.control = new NextclawKernelControlManager<
      unknown,
      unknown,
      unknown
    >();
    this.channels = new ChannelManager({
      bus: this.messageBus,
    });
    this.configManager = new ConfigManager({
      configPath: options.configPath,
      channels: this.channels,
      providerManager: this.llmProviders,
    });
    this.accessManager = new AccessManager({
      configManager: this.configManager,
      homeDir: options.homeDir,
    });
    this.sessionManager = new SessionManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      journalStore: this.ncpAgentSessionJournalStore,
      sessionSearch: this.sessionSearch,
    });
    this.panelAppManager = new PanelAppManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
    });
    this.serviceAppManager = new ServiceAppManager({
      configManager: this.configManager,
    });
    this.extensions = new ExtensionManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      messageBus: this.messageBus,
      sessionManager: this.sessionManager,
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
      this.configManager,
      this.llmProviders,
      this.sessionManager,
    );
    this.sessionRunManager = new SessionRunManager(this.sessionManager);
    this.agentRunRequestManager = new AgentRunRequestManager(
      this.agentRuntimeManager,
      this.configManager,
      this.contextProviderManager,
      this.eventBus,
      this.ingress,
      this.sessionManager,
      this.sessionRunManager,
      this.toolProviderManager,
    );
    this.contributions = [
      new ToolProviderContribution(this),
      new SessionActivityPreviewContribution(this),
      new LearningLoopContribution(this),
      new ContextProviderContribution(this),
      new AgentRunRuntimeContribution(this),
      new ContextWindowContribution(this),
    ];
  }

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
    void this.sessionSearch.start();
    this.mcpManager.start();
    this.sessionManager.start();
    for (const contribution of this.contributions) {
      contribution.start();
    }
    this.agentRunRequestManager.start();
  };

  dispose = async (): Promise<void> => {
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
  };
}
