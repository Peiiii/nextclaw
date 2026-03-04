import {
  NativeAgentEngine,
  type AgentEngine,
  type AgentEngineFactory,
  type AgentEngineFactoryContext,
  type AgentEngineMessageToolHintsResolver,
  AgentRouteResolver,
  getWorkspacePath,
  parseAgentScopedSessionKey,
  type SessionEvent,
  type Config,
  type CronService,
  type ExtensionRegistry,
  type GatewayController,
  type InboundMessage,
  type MessageBus,
  type ProviderManager,
  type SessionManager
} from "@nextclaw/core";

type AgentProfileRuntime = {
  id: string;
  engine: AgentEngine;
};

type ResolvedAgentProfile = {
  id: string;
  workspace: string;
  model: string;
  maxIterations: number;
  contextTokens: number;
  engine: string;
  engineConfig: Record<string, unknown> | undefined;
};

function normalizeAgentId(value: string | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  return text || "main";
}

function normalizeEngineKind(value: unknown): string {
  if (typeof value !== "string") {
    return "native";
  }
  const kind = value.trim().toLowerCase();
  return kind || "native";
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function resolveAgentProfiles(config: Config): ResolvedAgentProfile[] {
  const defaults = config.agents.defaults;
  type ListedAgentProfile = {
    id: string;
    default?: boolean;
    workspace?: string;
    model?: string;
    engine?: string;
    engineConfig?: Record<string, unknown>;
    maxToolIterations?: number;
    contextTokens?: number;
  };
  const listed = Array.isArray(config.agents.list)
    ? config.agents.list
        .map((entry) => ({
          id: normalizeAgentId(entry.id),
          default: entry.default,
          workspace: entry.workspace,
          model: entry.model,
          engine: entry.engine,
          engineConfig: toRecord(entry.engineConfig),
          maxToolIterations: entry.maxToolIterations,
          contextTokens: entry.contextTokens
        }))
        .filter((entry) => Boolean(entry.id))
    : [];

  const defaultAgentId = listed.find((entry) => entry.default)?.id ?? listed[0]?.id ?? "main";
  const seed: ListedAgentProfile[] = listed.length > 0 ? listed : [{ id: defaultAgentId }];

  const unique = new Map<string, (typeof seed)[number]>();
  for (const entry of seed) {
    if (!unique.has(entry.id)) {
      unique.set(entry.id, entry);
    }
  }
  if (!unique.has(defaultAgentId)) {
    unique.set(defaultAgentId, { id: defaultAgentId });
  }

  return Array.from(unique.values()).map((entry) => ({
    id: entry.id,
    workspace: getWorkspacePath(entry.workspace ?? defaults.workspace),
    model: entry.model ?? defaults.model,
    engine: normalizeEngineKind(entry.engine ?? defaults.engine),
    engineConfig: entry.engineConfig ?? toRecord(defaults.engineConfig),
    maxIterations: entry.maxToolIterations ?? defaults.maxToolIterations,
    contextTokens: entry.contextTokens ?? defaults.contextTokens
  }));
}

export class GatewayAgentRuntimePool {
  private routeResolver: AgentRouteResolver;
  private runtimes = new Map<string, AgentProfileRuntime>();
  private running = false;
  private defaultAgentId = "main";

  constructor(
    private options: {
      bus: MessageBus;
      providerManager: ProviderManager;
      sessionManager: SessionManager;
      cronService?: CronService | null;
      restrictToWorkspace: boolean;
      braveApiKey?: string;
      execConfig: { timeout: number };
      contextConfig: Config["agents"]["context"];
      gatewayController?: GatewayController;
      extensionRegistry?: ExtensionRegistry;
      resolveMessageToolHints?: AgentEngineMessageToolHintsResolver;
      config: Config;
    }
  ) {
    this.routeResolver = new AgentRouteResolver(options.config);
    this.rebuild(options.config);
  }

  get primaryAgentId(): string {
    return this.defaultAgentId;
  }

  applyRuntimeConfig(config: Config): void {
    this.options.config = config;
    this.options.contextConfig = config.agents.context;
    this.options.execConfig = config.tools.exec;
    this.options.restrictToWorkspace = config.tools.restrictToWorkspace;
    this.options.braveApiKey = config.tools.web.search.apiKey || undefined;
    this.routeResolver.updateConfig(config);
    this.rebuild(config);
  }

  applyExtensionRegistry(extensionRegistry?: ExtensionRegistry): void {
    this.options.extensionRegistry = extensionRegistry;
    this.rebuild(this.options.config);
  }

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
    abortSignal?: AbortSignal;
    onAssistantDelta?: (delta: string) => void;
    onSessionEvent?: (event: SessionEvent) => void;
  }): Promise<string> {
    const { message, route } = this.resolveDirectRoute({
      content: params.content,
      sessionKey: params.sessionKey,
      channel: params.channel,
      chatId: params.chatId,
      metadata: params.metadata,
      agentId: params.agentId
    });
    const runtime = this.resolveRuntime(route.agentId);
    return runtime.engine.processDirect({
      content: params.content,
      sessionKey: route.sessionKey,
      channel: message.channel,
      chatId: message.chatId,
      metadata: message.metadata,
      abortSignal: params.abortSignal,
      onAssistantDelta: params.onAssistantDelta,
      onSessionEvent: params.onSessionEvent
    });
  }

  supportsTurnAbort(params: {
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
  }): { supported: boolean; agentId: string; reason?: string } {
    const { route } = this.resolveDirectRoute({
      content: "",
      sessionKey: params.sessionKey,
      channel: params.channel,
      chatId: params.chatId,
      metadata: params.metadata,
      agentId: params.agentId
    });
    const runtime = this.resolveRuntime(route.agentId);
    if (runtime.engine.kind !== "native") {
      return {
        supported: false,
        agentId: route.agentId,
        reason: `engine "${runtime.engine.kind}" does not support server-side stop yet`
      };
    }
    return {
      supported: true,
      agentId: route.agentId
    };
  }

  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      const message = await this.options.bus.consumeInbound();
      try {
        const explicitSessionKey = this.readString(message.metadata.session_key_override);
        const forcedAgentId = this.readString(message.metadata.target_agent_id);
        const route = this.routeResolver.resolveInbound({
          message,
          forcedAgentId,
          sessionKeyOverride: explicitSessionKey
        });
        const runtime = this.resolveRuntime(route.agentId);
        await runtime.engine.handleInbound({
          message,
          sessionKey: route.sessionKey,
          publishResponse: true
        });
      } catch (error) {
        await this.options.bus.publishOutbound({
          channel: message.channel,
          chatId: message.chatId,
          content: `Sorry, I encountered an error: ${String(error)}`,
          media: [],
          metadata: {}
        });
      }
    }
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private resolveDirectRoute(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
  }): {
    message: InboundMessage;
    route: ReturnType<AgentRouteResolver["resolveInbound"]>;
  } {
    const message: InboundMessage = {
      channel: params.channel ?? "cli",
      senderId: "user",
      chatId: params.chatId ?? "direct",
      content: params.content,
      timestamp: new Date(),
      attachments: [],
      metadata: params.metadata ?? {}
    };
    const forcedAgentId =
      this.readString(params.agentId) ?? parseAgentScopedSessionKey(params.sessionKey)?.agentId ?? undefined;
    const route = this.routeResolver.resolveInbound({
      message,
      forcedAgentId,
      sessionKeyOverride: params.sessionKey
    });
    return {
      message,
      route
    };
  }

  private resolveRuntime(agentId: string): AgentProfileRuntime {
    const normalized = normalizeAgentId(agentId);
    const runtime = this.runtimes.get(normalized);
    if (runtime) {
      return runtime;
    }
    const fallback = this.runtimes.get(this.defaultAgentId);
    if (fallback) {
      return fallback;
    }
    throw new Error("No agent runtime available");
  }

  private createNativeEngineFactory(): AgentEngineFactory {
    return (context: AgentEngineFactoryContext) =>
      new NativeAgentEngine({
        bus: context.bus,
        providerManager: context.providerManager,
        workspace: context.workspace,
        model: context.model,
        maxIterations: context.maxIterations,
        contextTokens: context.contextTokens,
        braveApiKey: context.braveApiKey,
        execConfig: context.execConfig,
        cronService: context.cronService,
        restrictToWorkspace: context.restrictToWorkspace,
        sessionManager: context.sessionManager,
        contextConfig: context.contextConfig,
        gatewayController: context.gatewayController,
        config: context.config,
        extensionRegistry: context.extensionRegistry,
        resolveMessageToolHints: context.resolveMessageToolHints,
        agentId: context.agentId
      });
  }

  private resolveEngineFactory(kind: string): AgentEngineFactory {
    if (kind === "native") {
      return this.createNativeEngineFactory();
    }
    const registrations = this.options.extensionRegistry?.engines ?? [];
    const matched = registrations.find((entry) => normalizeEngineKind(entry.kind) === kind);
    if (matched) {
      return matched.factory;
    }
    console.warn(`[engine] unknown engine "${kind}", fallback to "native"`);
    return this.createNativeEngineFactory();
  }

  private createEngine(profile: ResolvedAgentProfile, config: Config): AgentEngine {
    const kind = normalizeEngineKind(profile.engine);
    const factory = this.resolveEngineFactory(kind);
    const context: AgentEngineFactoryContext = {
      agentId: profile.id,
      workspace: profile.workspace,
      model: profile.model,
      maxIterations: profile.maxIterations,
      contextTokens: profile.contextTokens,
      engineConfig: profile.engineConfig,
      bus: this.options.bus,
      providerManager: this.options.providerManager,
      sessionManager: this.options.sessionManager,
      cronService: this.options.cronService,
      restrictToWorkspace: this.options.restrictToWorkspace,
      braveApiKey: this.options.braveApiKey,
      execConfig: this.options.execConfig,
      contextConfig: this.options.contextConfig,
      gatewayController: this.options.gatewayController,
      config,
      extensionRegistry: this.options.extensionRegistry,
      resolveMessageToolHints: this.options.resolveMessageToolHints
    };
    try {
      return factory(context);
    } catch (error) {
      if (kind === "native") {
        throw error;
      }
      console.warn(`[engine] failed to create "${kind}" for agent "${profile.id}": ${String(error)}`);
      return this.createNativeEngineFactory()(context);
    }
  }

  private rebuild(config: Config): void {
    const profiles = resolveAgentProfiles(config);
    const configuredDefault = this.readString(config.agents.list.find((entry) => entry.default)?.id);
    this.defaultAgentId = configuredDefault ?? profiles[0]?.id ?? "main";

    const nextRuntimes = new Map<string, AgentProfileRuntime>();
    for (const profile of profiles) {
      const engine = this.createEngine(profile, config);
      nextRuntimes.set(profile.id, {
        id: profile.id,
        engine
      });
    }
    this.runtimes = nextRuntimes;
  }
}
