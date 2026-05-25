import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { McpManager } from "@kernel/managers/mcp.manager.js";
import { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import {
  createAgentRuntimeSessionRequestDispatcher,
  SessionRequestManager,
} from "@kernel/features/session-request/index.js";
import { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import { LegacyAgentRunContribution } from "@kernel/contributions/legacy-agent-run/index.js";
import { LearningLoopContribution } from "@kernel/contributions/learning-loop/index.js";
import { SessionActivityPreviewContribution } from "@kernel/contributions/session-activity-preview/index.js";
import { ToolContribution } from "@kernel/contributions/tool-contribution/index.js";
import { ContextCompactionManager } from "@kernel/features/context-compaction/index.js";
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
  SessionManager,
  SessionSearchManager,
} from "@nextclaw/core";
import { EventBus, Ingress } from "@nextclaw/shared";
import { resolve } from "node:path";

export type NextclawKernelOptions = {
  homeDir?: string;
  configPath?: string;
};

type AgentRunChain = "branch" | "legacy";
type AgentRunContribution = KernelContribution & {
  listSessionTypes: (params?: AgentRuntimeSessionTypeDescribeParams) => ReturnType<AgentRuntimeManager["listSessionTypes"]>;
};

const AGENT_RUN_CHAIN: AgentRunChain = "branch";

function resolveKernelSessionsDir(options: NextclawKernelOptions): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return ensureDir(resolve(expandHome(homeDir), "sessions"));
  }
  return getSessionsPath();
}

function resolveKernelAutomationStorePath(options: NextclawKernelOptions): string {
  const homeDir = options.homeDir?.trim();
  if (homeDir) {
    return resolve(expandHome(homeDir), "cron", "jobs.json");
  }
  return resolve(getDataDir(), "cron", "jobs.json");
}

type NextclawKernelRuntimeControl<
  TGatewayInput,
  TUiInput,
  TStartInput,
> = {
  gateway: (input: TGatewayInput) => Promise<void>;
  ui: (input: TUiInput) => Promise<void>;
  start: (input: TStartInput) => Promise<void>;
  restart: (input: TStartInput) => Promise<void>;
  serve: (input: TStartInput) => Promise<void>;
  stop: () => Promise<void>;
};

class NextclawKernelControlManager<
  TGatewayInput,
  TUiInput,
  TStartInput,
> {
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
  readonly agents: AgentManager;
  readonly sessions: SessionManager;
  readonly control: NextclawKernelControlManager<
    unknown,
    unknown,
    unknown
  >;
  readonly toolManager: ToolManager;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly channels: ChannelManager;
  readonly sessionRequests: SessionRequestManager;
  readonly sessionSearch: SessionSearchManager;
  readonly assetStore: LocalAssetStore;
  readonly mcpManager: McpManager;
  readonly ncpSessionManager: NcpSessionManager;
  readonly extensions: ExtensionManager;
  readonly agentRunRequestManager: AgentRunRequestManager;
  readonly sessionRunManager: SessionRunManager;
  readonly agentRuntimeManager: AgentRuntimeManager;
  private readonly ncpAgentSessionJournalStore: NcpAgentSessionJournalStore;
  private readonly agentRunContribution: AgentRunContribution;
  private readonly contributions: KernelContribution[];
  private gatewayController: GatewayController | undefined;

  constructor(options: NextclawKernelOptions = {}) {
    const sessionsDir = resolveKernelSessionsDir(options);
    this.sessions = new SessionManager({
      sessionsDir,
    });
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
    this.toolManager = new ToolManager();
    this.channels = new ChannelManager({
      bus: this.messageBus,
      sessionManager: this.sessions,
    });
    this.configManager = new ConfigManager({
      configPath: options.configPath,
      channels: this.channels,
      providerManager: this.llmProviders,
    });
    this.extensions = new ExtensionManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      ingress: this.ingress,
      messageBus: this.messageBus,
      sessionManager: this.sessions,
    });
    this.skills = new SkillManager({
      workspace: getWorkspacePath(this.configManager.config.agents.defaults.workspace),
    });
    this.mcpManager = new McpManager(this.configManager.loadConfig);
    this.configManager.installRuntimeHooks({
      resolveChannelConfig: this.extensions.toConfigView,
      getExtensionChannels: () => this.extensions.getExtensionRegistry().channels,
      reloadMcp: async ({ config }) => await this.mcpManager.applyConfig(config),
    });
    this.agentRuntimeManager = new AgentRuntimeManager({
      configManager: this.configManager,
      assetStore: this.assetStore,
    });
    this.ncpSessionManager = new NcpSessionManager({
      configManager: this.configManager,
      eventBus: this.eventBus,
      journalStore: this.ncpAgentSessionJournalStore,
      sessionSearch: this.sessionSearch,
    });
    this.sessionRequests = new SessionRequestManager({
      ncpSessionManager: this.ncpSessionManager,
      dispatcher: createAgentRuntimeSessionRequestDispatcher({
        eventBus: this.eventBus,
        ingress: this.ingress,
      }),
    });
    this.sessionRunManager = new SessionRunManager({
      agentRuntimeManager: this.agentRuntimeManager,
      eventBus: this.eventBus,
      ncpSessionManager: this.ncpSessionManager,
    });
    this.agentRunRequestManager = new AgentRunRequestManager({
      contextCompactionManager: new ContextCompactionManager({
        configManager: this.configManager,
        providerManager: this.llmProviders,
        sessionRunManager: this.sessionRunManager,
      }),
      ingress: this.ingress,
      ncpSessionManager: this.ncpSessionManager,
      sessionRunManager: this.sessionRunManager,
    });
    this.agentRunContribution =
      AGENT_RUN_CHAIN === "branch"
        ? new KernelBranch(this)
        : new LegacyAgentRunContribution(this);
    this.contributions = [
      new ToolContribution(this),
      new SessionActivityPreviewContribution(this),
      new LearningLoopContribution(this),
      this.agentRunContribution,
    ];
  }

  listSessionTypes = (params?: AgentRuntimeSessionTypeDescribeParams) =>
    this.agentRunContribution.listSessionTypes(params);

  provideGatewayController = (gatewayController: GatewayController): void => {
    this.gatewayController = gatewayController;
  };

  getGatewayController = (): GatewayController | undefined => this.gatewayController;

  start = async (): Promise<void> => {
    void this.sessionSearch.start();
    this.mcpManager.start();
    for (const contribution of this.contributions) {
      contribution.start();
    }
  };

  dispose = async (): Promise<void> => {
    for (const contribution of [...this.contributions].reverse()) {
      await contribution.dispose();
    }
    this.ncpSessionManager.dispose();
    await this.agentRuntimeManager.dispose();
    await this.mcpManager.dispose();
    await this.sessionSearch.dispose();
  };

}
