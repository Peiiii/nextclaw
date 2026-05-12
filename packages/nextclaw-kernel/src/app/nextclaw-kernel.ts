import { AgentManager } from "@kernel/managers/agent.manager.js";
import { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { AutomationManager } from "@kernel/managers/automation.manager.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { ExtensionManager } from "@kernel/managers/extension.manager.js";
import { LearningLoopManager } from "@kernel/managers/learning-loop.manager.js";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { LlmUsageManager } from "@kernel/managers/llm-usage.manager.js";
import { SkillManager } from "@kernel/managers/skill.manager.js";
import { ToolManager } from "@kernel/managers/tool.manager.js";
import { readLearningLoopRuntimeConfig } from "@kernel/configs/learning-loop.config.js";
import { NcpLifecycleEventBridge } from "@kernel/services/ncp-lifecycle-event-bridge.service.js";
import { NcpSessionApiService } from "@kernel/services/ncp-session-api.service.js";
import { NcpAgentSessionStoreAdapter } from "@kernel/services/ncp-agent-session-store-adapter.service.js";
import { createAgentRuntimeSessionRequestDispatcher } from "@kernel/features/session-request/index.js";
import {
  ChannelManager,
  ensureDir,
  expandHome,
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
  readonly tools: ToolManager;
  readonly skills: SkillManager;
  readonly automation: AutomationManager;
  readonly channels: ChannelManager;
  readonly sessionRequests: SessionRequestManager;
  readonly sessionSearch: SessionSearchManager;
  readonly ncpSessionApi: NcpSessionApiService;
  readonly extensions: ExtensionManager;
  readonly agentRuntimeManager: AgentRuntimeManager;
  readonly learningLoop: LearningLoopManager;
  private readonly sessionLifecycleEvents: NcpLifecycleEventBridge;
  private readonly ncpAgentSessionStore: NcpAgentSessionStoreAdapter;
  private startPromise: Promise<void> | null = null;

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
    this.ncpAgentSessionStore = new NcpAgentSessionStoreAdapter(this.sessions, {
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
    this.agents = new AgentManager();
    this.control = new NextclawKernelControlManager<
      unknown,
      unknown,
      unknown
    >();
    this.tools = new ToolManager();
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
    this.ncpSessionApi = new NcpSessionApiService({
      eventBus: this.eventBus,
      getConfig: this.configManager.loadConfig,
      sessionManager: this.sessions,
    });
    this.agentRuntimeManager = new AgentRuntimeManager({
      bus: this.messageBus,
      providerManager: this.llmProviders,
      sessions: this.sessions,
      ingress: this.ingress,
      sessionRequests: this.sessionRequests,
      sessionSearch: this.sessionSearch,
      ncpAgentSessionStore: this.ncpAgentSessionStore,
      cronService: this.automation,
      configManager: this.configManager,
      extensions: this.extensions,
      eventBus: this.eventBus,
      handleNcpEvent: this.handleNcpEvent,
      llmUsage: this.llmUsage,
      onSessionUpdated: this.publishSessionUpdated,
    });
    this.learningLoop = new LearningLoopManager({
      eventBus: this.eventBus,
      sessionManager: this.sessions,
      sessionRequester: this.sessionRequests,
      resolveLearningLoopConfig: () =>
        readLearningLoopRuntimeConfig(this.configManager.loadConfig()),
    });
  }

  start = async (): Promise<void> => {
    this.startPromise ??= Promise.resolve()
      .then(() => {
        this.ncpSessionApi.start();
      })
      .then(() => this.sessionSearch.start())
      .then(() => this.agentRuntimeManager.bootstrap())
      .then(() => {
        this.learningLoop.start();
      })
      .catch((error: unknown) => {
        this.startPromise = null;
        throw error;
      });
    return this.startPromise;
  };

  dispose = async (): Promise<void> => {
    this.learningLoop.dispose();
    this.ncpSessionApi.dispose();
    await this.agentRuntimeManager.dispose();
    await this.sessionSearch.dispose();
    this.startPromise = null;
  };

  private publishSessionUpdated = (sessionKey: string): void => {
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
