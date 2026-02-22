import {
  AgentLoop,
  AgentRouteResolver,
  getWorkspacePath,
  parseAgentScopedSessionKey,
  type Config,
  type CronService,
  type ExtensionRegistry,
  type GatewayController,
  type InboundMessage,
  type MessageBus,
  type ProviderManager,
  type SessionManager
} from "@nextclaw/core";

type MessageToolHintsResolver = (params: {
  sessionKey: string;
  channel: string;
  chatId: string;
  accountId?: string | null;
}) => string[];

type AgentProfileRuntime = {
  id: string;
  loop: AgentLoop;
};

function normalizeAgentId(value: string | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  return text || "main";
}

function resolveAgentProfiles(config: Config): Array<{
  id: string;
  workspace: string;
  model: string;
  maxIterations: number;
  maxTokens: number;
  contextTokens: number;
}> {
  const defaults = config.agents.defaults;
  type ListedAgentProfile = {
    id: string;
    default?: boolean;
    workspace?: string;
    model?: string;
    maxToolIterations?: number;
    maxTokens?: number;
    contextTokens?: number;
  };
  const listed = Array.isArray(config.agents.list)
    ? config.agents.list
        .map((entry) => ({
          id: normalizeAgentId(entry.id),
          default: entry.default,
          workspace: entry.workspace,
          model: entry.model,
          maxToolIterations: entry.maxToolIterations,
          maxTokens: entry.maxTokens,
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
    maxIterations: entry.maxToolIterations ?? defaults.maxToolIterations,
    maxTokens: entry.maxTokens ?? defaults.maxTokens,
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
      resolveMessageToolHints?: MessageToolHintsResolver;
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

  async processDirect(params: {
    content: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
    agentId?: string;
  }): Promise<string> {
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
    const runtime = this.resolveRuntime(route.agentId);
    return runtime.loop.processDirect({
      content: params.content,
      sessionKey: route.sessionKey,
      channel: message.channel,
      chatId: message.chatId,
      metadata: message.metadata
    });
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
        await runtime.loop.handleInbound({
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

  private rebuild(config: Config): void {
    const profiles = resolveAgentProfiles(config);
    const configuredDefault = this.readString(config.agents.list.find((entry) => entry.default)?.id);
    this.defaultAgentId = configuredDefault ?? profiles[0]?.id ?? "main";

    const nextRuntimes = new Map<string, AgentProfileRuntime>();
    for (const profile of profiles) {
      const loop = new AgentLoop({
        bus: this.options.bus,
        providerManager: this.options.providerManager,
        workspace: profile.workspace,
        model: profile.model,
        maxIterations: profile.maxIterations,
        maxTokens: profile.maxTokens,
        contextTokens: profile.contextTokens,
        braveApiKey: this.options.braveApiKey,
        execConfig: this.options.execConfig,
        cronService: this.options.cronService,
        restrictToWorkspace: this.options.restrictToWorkspace,
        sessionManager: this.options.sessionManager,
        contextConfig: this.options.contextConfig,
        gatewayController: this.options.gatewayController,
        config,
        extensionRegistry: this.options.extensionRegistry,
        resolveMessageToolHints: this.options.resolveMessageToolHints,
        agentId: profile.id
      });
      nextRuntimes.set(profile.id, {
        id: profile.id,
        loop
      });
    }
    this.runtimes = nextRuntimes;
  }
}
