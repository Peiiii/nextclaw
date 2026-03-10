import {
  NativeAgentEngine,
  CommandRegistry,
  createAssistantStreamDeltaControlMessage,
  createAssistantStreamResetControlMessage,
  type CommandOption,
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

type SystemSessionUpdatedHandler = (params: {
  sessionKey: string;
  message: InboundMessage;
}) => void;

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
  private dynamicEngineRuntimes = new Map<string, AgentProfileRuntime>();
  private resolvedProfiles: ResolvedAgentProfile[] = [];
  private running = false;
  private defaultAgentId = "main";
  private onSystemSessionUpdated: SystemSessionUpdatedHandler | null = null;

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

  setSystemSessionUpdatedHandler(handler: SystemSessionUpdatedHandler | null): void {
    this.onSystemSessionUpdated = handler;
  }

  listAvailableEngineKinds(): string[] {
    const kinds = new Set<string>(["native"]);
    for (const runtime of this.runtimes.values()) {
      kinds.add(normalizeEngineKind(runtime.engine.kind));
    }
    for (const registration of this.options.extensionRegistry?.engines ?? []) {
      kinds.add(normalizeEngineKind(registration.kind));
    }
    return Array.from(kinds).sort((left, right) => {
      if (left === "native") {
        return -1;
      }
      if (right === "native") {
        return 1;
      }
      return left.localeCompare(right);
    });
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
    const forcedEngineKind = this.readForcedEngineKind(message.metadata);
    const commandResult = await this.executeDirectCommand(params.content, {
      channel: message.channel,
      chatId: message.chatId,
      sessionKey: route.sessionKey
    });
    if (commandResult) {
      return commandResult;
    }
    const runtime = forcedEngineKind
      ? this.resolveRuntimeForEngineKind(forcedEngineKind, route.agentId)
      : this.resolveRuntime(route.agentId);
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

  private async executeDirectCommand(
    rawContent: string,
    ctx: { channel: string; chatId: string; sessionKey: string }
  ): Promise<string | null> {
    const trimmed = rawContent.trim();
    if (!trimmed.startsWith("/")) {
      return null;
    }
    const registry = new CommandRegistry(this.options.config, this.options.sessionManager);
    const executeText = (
      registry as CommandRegistry & {
        executeText?: (input: string, execCtx: {
          channel: string;
          chatId: string;
          senderId: string;
          sessionKey: string;
        }) => Promise<{ content: string } | null>;
      }
    ).executeText;
    if (typeof executeText === "function") {
      const result = await executeText.call(registry, rawContent, {
        channel: ctx.channel,
        chatId: ctx.chatId,
        senderId: "user",
        sessionKey: ctx.sessionKey
      });
      return result?.content ?? null;
    }
    const commandRaw = trimmed.slice(1).trim();
    if (!commandRaw) {
      return null;
    }
    const [nameToken, ...restTokens] = commandRaw.split(/\s+/);
    const commandName = nameToken.trim().toLowerCase();
    if (!commandName) {
      return null;
    }
    const commandTail = restTokens.join(" ").trim();
    const specs = registry.listSlashCommands();
    const args = parseCommandArgsFromText(commandName, commandTail, specs);
    const result = await registry.execute(commandName, args, {
      channel: ctx.channel,
      chatId: ctx.chatId,
      senderId: "user",
      sessionKey: ctx.sessionKey
    });
    return result?.content ?? null;
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
    const forcedEngineKind = this.readForcedEngineKind(params.metadata);
    let runtime: AgentProfileRuntime;
    try {
      runtime = forcedEngineKind
        ? this.resolveRuntimeForEngineKind(forcedEngineKind, route.agentId)
        : this.resolveRuntime(route.agentId);
    } catch (error) {
      return {
        supported: false,
        agentId: route.agentId,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
    const supportsAbort = runtime.engine.supportsAbort ?? runtime.engine.kind === "native";
    if (!supportsAbort) {
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
        if (message.channel !== "system") {
          await this.options.bus.publishOutbound(createAssistantStreamResetControlMessage(message));
        }
        await runtime.engine.handleInbound({
          message,
          sessionKey: route.sessionKey,
          publishResponse: true,
          onAssistantDelta:
            message.channel !== "system"
              ? (delta) => {
                  if (!delta) {
                    return;
                  }
                  void this.options.bus.publishOutbound(createAssistantStreamDeltaControlMessage(message, delta));
                }
              : undefined
        });
        if (message.channel === "system") {
          this.onSystemSessionUpdated?.({
            sessionKey: route.sessionKey,
            message
          });
        }
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

  private readForcedEngineKind(metadata?: Record<string, unknown>): string | undefined {
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    const raw =
      this.readString(metadata.session_type) ??
      this.readString(metadata.sessionType) ??
      this.readString(metadata.engine_kind) ??
      this.readString(metadata.engineKind);
    return raw ? normalizeEngineKind(raw) : undefined;
  }

  private findRuntimeByEngineKind(kind: string, preferredAgentId?: string): AgentProfileRuntime | null {
    const normalizedKind = normalizeEngineKind(kind);
    const preferred = preferredAgentId ? this.runtimes.get(normalizeAgentId(preferredAgentId)) : null;
    if (preferred && normalizeEngineKind(preferred.engine.kind) === normalizedKind) {
      return preferred;
    }
    for (const runtime of this.runtimes.values()) {
      if (normalizeEngineKind(runtime.engine.kind) === normalizedKind) {
        return runtime;
      }
    }
    return null;
  }

  private resolveBaseProfileForDynamicEngine(agentId: string): ResolvedAgentProfile {
    const normalizedAgentId = normalizeAgentId(agentId);
    return (
      this.resolvedProfiles.find((profile) => profile.id === normalizedAgentId) ??
      this.resolvedProfiles.find((profile) => profile.id === this.defaultAgentId) ??
      this.resolvedProfiles[0] ?? {
        id: this.defaultAgentId,
        workspace: getWorkspacePath(this.options.config.agents.defaults.workspace),
        model: this.options.config.agents.defaults.model,
        maxIterations: this.options.config.agents.defaults.maxToolIterations,
        contextTokens: this.options.config.agents.defaults.contextTokens,
        engine: "native",
        engineConfig: toRecord(this.options.config.agents.defaults.engineConfig)
      }
    );
  }

  private resolveRuntimeForEngineKind(kind: string, fallbackAgentId: string): AgentProfileRuntime {
    const normalizedKind = normalizeEngineKind(kind);
    const existing = this.findRuntimeByEngineKind(normalizedKind, fallbackAgentId);
    if (existing) {
      return existing;
    }

    if (!this.listAvailableEngineKinds().includes(normalizedKind)) {
      throw new Error(`engine "${normalizedKind}" is not available`);
    }

    const cached = this.dynamicEngineRuntimes.get(normalizedKind);
    if (cached) {
      return cached;
    }

    const baseProfile = this.resolveBaseProfileForDynamicEngine(fallbackAgentId);
    const dynamicProfile: ResolvedAgentProfile = {
      ...baseProfile,
      id: `__session_engine__${normalizedKind}`,
      engine: normalizedKind
    };
    const runtime: AgentProfileRuntime = {
      id: dynamicProfile.id,
      engine: this.createEngine(dynamicProfile, this.options.config)
    };
    this.dynamicEngineRuntimes.set(normalizedKind, runtime);
    return runtime;
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
    this.resolvedProfiles = profiles;
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
    this.dynamicEngineRuntimes.clear();
  }
}

function parseCommandArgsFromText(
  commandName: string,
  rawTail: string,
  specs: Array<{ name: string; options?: CommandOption[] }>
): Record<string, unknown> {
  if (!rawTail) {
    return {};
  }
  const command = specs.find((item) => item.name.trim().toLowerCase() === commandName);
  const options = command?.options;
  if (!options || options.length === 0) {
    return {};
  }

  const tokens = rawTail.split(/\s+/).filter(Boolean);
  const args: Record<string, unknown> = {};
  let cursor = 0;
  for (let i = 0; i < options.length; i += 1) {
    if (cursor >= tokens.length) {
      break;
    }
    const option = options[i];
    const isLastOption = i === options.length - 1;
    const rawValue = isLastOption ? tokens.slice(cursor).join(" ") : tokens[cursor];
    cursor += isLastOption ? tokens.length - cursor : 1;
    const parsedValue = parseCommandOptionValue(option.type, rawValue);
    if (parsedValue !== undefined) {
      args[option.name] = parsedValue;
    }
  }
  return args;
}

function parseCommandOptionValue(type: CommandOption["type"], rawValue: string): string | number | boolean | undefined {
  const value = rawValue.trim();
  if (!value) {
    return undefined;
  }
  if (type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === "boolean") {
    const lowered = value.toLowerCase();
    if (["1", "true", "yes", "on"].includes(lowered)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(lowered)) {
      return false;
    }
    return undefined;
  }
  return value;
}
