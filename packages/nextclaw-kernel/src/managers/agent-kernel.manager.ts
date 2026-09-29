import { EventBus, Ingress } from "@nextclaw/shared";
import { AgentManager } from "./agent.manager.js";
import { AgentContextWindowManager } from "./agent-context-window.manager.js";
import { AgentRunContextCompactionManager } from "./agent-run-context-compaction.manager.js";
import { AgentRunRequestManager } from "./agent-run-request.manager.js";
import { AgentRuntimeManager } from "./agent-runtime.manager.js";
import { ContextProviderManager } from "./context-provider.manager.js";
import { ToolProviderManager } from "./tool-provider.manager.js";
import { SessionManager } from "./session.manager.js";
import { SessionRunManager } from "./session-run.manager.js";
import { UserQuestionManager } from "./user-question.manager.js";
import { createNativeAgentRuntimeRegistration } from "@kernel/features/native-runtime/services/native-agent-runtime.service.js";
import type { AgentKernelResources } from "@kernel/types/agent-platform.types.js";
import type { IKernel } from "@kernel/types/kernel-capability.types.js";
import type { Config } from "@nextclaw/core";
import { SessionConversationToolProvider } from "@kernel/contributions/tool-provider/providers/session-conversation-tool.provider.js";
import { StructuredResultToolProvider } from "@kernel/contributions/tool-provider/providers/structured-result-tool.provider.js";
import { McpToolProvider } from "@kernel/contributions/tool-provider/providers/mcp-tool.provider.js";
import { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import { RequestContextTailManager } from "./request-context-tail.manager.js";
import { resolveAgentRuntimeEntries } from "@kernel/features/runtime-registry/index.js";
import { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { AgentBootstrapContextProvider } from "@kernel/contributions/context-provider/providers/agent-bootstrap-context.provider.js";
import { ExecutionPolicyContextProvider, renderAgentSafetyContext } from "@kernel/contributions/context-provider/providers/execution-policy-context.provider.js";
import { WorkspaceMemoryContextProvider } from "@kernel/contributions/context-provider/providers/workspace-memory-context.provider.js";
import { CurrentSessionContextProvider } from "@kernel/contributions/context-provider/providers/current-session-context.provider.js";
import { SessionRequestManager, createAgentRuntimeSessionRequestDispatcher,
  createAgentRuntimeSessionRequestSourceNotifier } from "@kernel/features/session-request/index.js";

/** Owns the shared Agent graph; environments supply persistence and I/O only. */
export class AgentKernel {
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
  readonly agents: AgentManager;
  readonly contextProviderManager = new ContextProviderManager();
  readonly toolProviderManager: ToolProviderManager;
  readonly requestContextTailManager = new RequestContextTailManager();
  readonly contextCompactionManager: AgentRunContextCompactionManager;
  readonly agentRuntimeManager = new AgentRuntimeManager();
  readonly agentContextWindowManager: AgentContextWindowManager;
  readonly sessionManager: SessionManager;
  readonly sessionRunManager: SessionRunManager;
  readonly sessionRequests: SessionRequestManager;
  readonly userQuestions: UserQuestionManager;
  readonly capabilities: IKernel;
  readonly configManager: { readonly config: Config };
  readonly agentRunRequestManager: AgentRunRequestManager;

  constructor(platform: AgentKernelResources) {
    this.eventBus = platform.eventBus ?? new EventBus();
    this.ingress = platform.ingress ?? new Ingress();
    this.toolProviderManager = new ToolProviderManager(platform.diagnostics);
    this.agents = new AgentManager(platform.profiles);
    this.configManager = { get config() { return platform.profiles.loadConfig(); } };
    const config = {
      getDefaultModel: () => this.configManager.config.agents.defaults.model,
      getModelMaxTokens: (model: string) => {
        const value = this.configManager.config.agents.defaults.models[model]?.params?.max_tokens;
        return typeof value === "number" ? Math.trunc(value) : undefined;
      },
    };
    this.agentContextWindowManager = new AgentContextWindowManager(
      this.agents, this.contextProviderManager, this.toolProviderManager, platform.assets,
    );
    this.sessionManager = new SessionManager({
      journalStore: platform.sessions, eventBus: this.eventBus,
      agentManager: this.agents, agentContextWindowManager: this.agentContextWindowManager,
      projectManager: platform.projects, resolveProjectContext: platform.resolveProjectContext,
      sessionSearch: platform.sessionSearch,
      providerManager: platform.sessionTitleProvider,
      beforeDeleteSession: platform.beforeDeleteSession,
    });
    this.sessionRunManager = new SessionRunManager(this.sessionManager, platform.productActivitySink);
    this.sessionRequests = new SessionRequestManager({
      sessionManager: this.sessionManager,
      dispatcher: createAgentRuntimeSessionRequestDispatcher({ eventBus: this.eventBus, ingress: this.ingress }),
      notifySourceSession: createAgentRuntimeSessionRequestSourceNotifier({ ingress: this.ingress }),
    });
    this.userQuestions = new UserQuestionManager(this.sessionManager, this.sessionRunManager, this.ingress);
    if (platform.contextFiles) {
      const context = new ContextProviderRunContextService({
        agents: this.agents, configManager: platform.profiles,
        sessionManager: this.sessionManager, toolProviderManager: this.toolProviderManager,
      }, { resolve: platform.resolveProjectContext });
      this.contextProviderManager.register({ provide: () => [renderAgentSafetyContext()] });
      this.contextProviderManager.register(new AgentBootstrapContextProvider(context, platform.contextFiles));
      this.contextProviderManager.register(new WorkspaceMemoryContextProvider(context, platform.contextFiles));
      this.contextProviderManager.register(new ExecutionPolicyContextProvider(context));
      if (platform.runtimeInfo) this.contextProviderManager.register(new CurrentSessionContextProvider(context, platform.runtimeInfo));
    }
    this.toolProviderManager.register(new SessionConversationToolProvider(this.sessionManager, this.userQuestions));
    this.toolProviderManager.register(new StructuredResultToolProvider());
    if (platform.mcp) {
      const context = new ToolProviderRunContextService(this.sessionManager, this.agents,
        platform.profiles, { resolve: platform.resolveProjectContext });
      this.toolProviderManager.register(new McpToolProvider(context, platform.mcp));
    }
    this.contextCompactionManager = new AgentRunContextCompactionManager(this.agents, platform.summaries, platform.assets);
    this.agentRuntimeManager.applyEntries(resolveAgentRuntimeEntries({ config: this.configManager.config }).entries);
    this.agentRuntimeManager.register(createNativeAgentRuntimeRegistration({
      models: platform.models, agents: this.agents, config, sessions: this.sessionManager,
      compaction: this.contextCompactionManager, assets: platform.assets, contextTail: this.requestContextTailManager,
    }));
    this.agentRunRequestManager = new AgentRunRequestManager(
      this.agentRuntimeManager, this.agents, config, this.agentContextWindowManager,
      this.eventBus, this.ingress, this.sessionManager, this.sessionRunManager,
      platform.diagnostics, platform.executionClaims,
    );
    this.capabilities = {
      eventBus: this.eventBus, ingress: this.ingress,
      tools: {
        register: (tool) => this.toolProviderManager.register({ provide: () => [tool] }),
        registerProvider: this.toolProviderManager.register,
      },
      context: this.contextProviderManager,
      get models() {
        if (!platform.modelRegistry) throw new Error("This platform has no model provider registry.");
        return platform.modelRegistry;
      },
      get mcp() {
        if (!platform.mcp) throw new Error("This platform has no MCP transport registry.");
        return platform.mcp;
      },
      runtimes: {
        registerProvider: (provider) => this.agentRuntimeManager.registerProvider(provider, {
          resolveAssetContentPath: (uri) => platform.assets?.resolveContentPath(uri) ?? null,
        }),
        registerEntry: this.agentRuntimeManager.registerEntry,
        listSessionTypes: this.agentRuntimeManager.listSessionTypes,
      },
    };
  }

  start = async (initialize?: () => Promise<void>): Promise<void> => {
    await this.sessionManager.start();
    await initialize?.();
    this.agentRunRequestManager.start();
  };

  dispose = async (): Promise<void> => {
    this.agentRunRequestManager.dispose();
    try {
      await this.sessionManager.flushSessionEvents();
    } finally {
      this.sessionManager.dispose();
      try { await this.agentRuntimeManager.dispose(); }
      finally {
        this.contextProviderManager.dispose();
        this.toolProviderManager.dispose();
        this.requestContextTailManager.dispose();
        this.sessionRunManager.dispose();
      }
    }
  };
}
