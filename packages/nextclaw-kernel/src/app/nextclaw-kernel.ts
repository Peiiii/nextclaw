import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { LearningLoopManager } from "@kernel/managers/learning-loop.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { McpManager } from "@kernel/managers/mcp.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import { readLearningLoopRuntimeConfig } from "@kernel/configs/learning-loop.config.js";
import { NcpLifecycleEventBridge } from "@kernel/services/ncp-lifecycle-event-bridge.service.js";
import { NcpSessionApiService } from "@kernel/services/ncp-session-api.service.js";
import { NcpAgentSessionStoreAdapter } from "@kernel/services/ncp-agent-session-store-adapter.service.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { createAgentRuntimeSessionRequestDispatcher } from "@kernel/features/session-request/index.js";
import { AgentRuntimeContribution } from "@kernel/contributions/agent-runtime/index.js";
import { SessionContextWindowContribution } from "@kernel/contributions/session-context-window/index.js";
import { SessionActivityPreviewContribution } from "@kernel/contributions/session-activity-preview/index.js";
import { ToolContribution } from "@kernel/contributions/tool-contribution/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  ChannelManager,
  ensureDir,
  expandHome,
  type GatewayController,
  getDataDir,
  getSessionsPath,
  MessageBus,
  SessionManager,
  SessionRequestManager,
  SessionSearchManager,
} from "@nextclaw/core";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import { eventKeys, EventBus, Ingress } from "@nextclaw/shared";
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
  readonly ncpSessionApi: NcpSessionApiService;
  readonly extensions: ExtensionManager;
  readonly agentRuntimeManager: AgentRuntimeManager;
  readonly learningLoop: LearningLoopManager;
  private readonly sessionLifecycleEvents: NcpLifecycleEventBridge;
  private readonly ncpAgentSessionStore: NcpAgentSessionStoreAdapter;
  private readonly ncpAgentSessionJournalStore: NcpAgentSessionJournalStore;
  private readonly contributions: KernelContribution[];
  private gatewayController: GatewayController | undefined;

  constructor(options: NextclawKernelOptions = {}) {
    const sessionsDir = resolveKernelSessionsDir(options);
    this.sessions = new SessionManager({
      sessionsDir,
    });
    this.sessionLifecycleEvents = new NcpLifecycleEventBridge(this.sessions, this.eventBus);
    this.sessionSearch = new SessionSearchManager({
      databasePath: resolve(getDataDir(), "session-search.db"),
      sessionsDir,
      onSessionUpdated: this.publishSessionUpdated,
    });
    this.ncpAgentSessionJournalStore = new NcpAgentSessionJournalStore(
      resolve(sessionsDir, ".ncp-agent-journal"),
    );
    this.ncpAgentSessionStore = new NcpAgentSessionStoreAdapter(this.sessions, {
      journalStore: this.ncpAgentSessionJournalStore,
      onSessionUpdated: this.sessionSearch.handleSessionUpdated,
    });
    this.sessionRequests = new SessionRequestManager({
      sessions: this.sessions,
      dispatcher: createAgentRuntimeSessionRequestDispatcher({
        eventBus: this.eventBus,
        ingress: this.ingress,
      }),
      onSessionUpdated: this.sessionSearch.handleSessionUpdated,
    });
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
    this.skills = new SkillManager();
    this.extensions = new ExtensionManager();
    this.channels = new ChannelManager({
      bus: this.messageBus,
      sessionManager: this.sessions,
    });
    this.configManager = new ConfigManager({
      configPath: options.configPath,
      channels: this.channels,
      providerManager: this.llmProviders,
    });
    this.mcpManager = new McpManager(this.configManager.loadConfig);
    this.agentRuntimeManager = new AgentRuntimeManager({
      sessions: this.sessions,
      ingress: this.ingress,
      ncpAgentSessionStore: this.ncpAgentSessionStore,
      configManager: this.configManager,
      eventBus: this.eventBus,
      handleNcpEvent: this.handleNcpEvent,
      onSessionUpdated: this.publishSessionUpdated,
      assetStore: this.assetStore,
    });
    this.ncpSessionApi = new NcpSessionApiService({
      eventBus: this.eventBus,
      getConfig: this.configManager.loadConfig,
      isLiveSessionRunning: this.agentRuntimeManager.isLiveSessionRunning,
      ncpAgentSessionStore: this.ncpAgentSessionStore,
      sessionManager: this.sessions,
    });
    this.learningLoop = new LearningLoopManager({
      eventBus: this.eventBus,
      sessionManager: this.sessions,
      sessionRequester: this.sessionRequests,
      resolveLearningLoopConfig: () =>
        readLearningLoopRuntimeConfig(this.configManager.loadConfig()),
    });
    this.contributions = [
      new AgentRuntimeContribution(this),
      new ToolContribution(this),
      new SessionActivityPreviewContribution(this),
      new SessionContextWindowContribution(this),
    ];
  }

  provideGatewayController = (gatewayController: GatewayController): void => {
    this.gatewayController = gatewayController;
  };

  getGatewayController = (): GatewayController | undefined => this.gatewayController;

  start = async (): Promise<void> => {
    this.ncpSessionApi.start();
    void this.sessionSearch.start();
    this.mcpManager.start();
    for (const contribution of this.contributions) {
      contribution.start();
    }
    void this.agentRuntimeManager.bootstrap();
    this.learningLoop.start();
  };

  dispose = async (): Promise<void> => {
    this.learningLoop.dispose();
    for (const contribution of this.contributions) {
      contribution.dispose();
    }
    this.ncpSessionApi.dispose();
    await this.agentRuntimeManager.dispose();
    await this.mcpManager.dispose();
    await this.sessionSearch.dispose();
  };

  publishSessionUpdated = (sessionKey: string): void => {
    this.sessionLifecycleEvents.publishSessionUpdated(sessionKey);
    this.eventBus.emit(eventKeys.sessionUpdated, { sessionKey }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  private handleNcpEvent = (event: NcpEndpointEvent): void => {
    this.sessionLifecycleEvents.handleEndpointEvent(event);
  };
}
