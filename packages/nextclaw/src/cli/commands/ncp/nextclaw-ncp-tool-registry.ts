import {
  CronTool,
  EditFileTool,
  ExecTool,
  ExtensionToolAdapter,
  GatewayTool,
  ListDirTool,
  MemoryGetTool,
  MemorySearchTool,
  MessageTool,
  ReadFileTool,
  SessionsHistoryTool,
  SessionsListTool,
  SessionsSendTool,
  SpawnTool,
  SubagentManager,
  SubagentsTool,
  ToolRegistry,
  WebFetchTool,
  WebSearchTool,
  WriteFileTool,
  type Config,
  type CronService,
  type ExtensionRegistry,
  type GatewayController,
  type MessageBus,
  type ProviderManager,
  type SearchConfig,
  type SessionManager,
} from "@nextclaw/core";
import type { Tool } from "@nextclaw/core";
import type { NcpTool, NcpToolDefinition, NcpToolRegistry } from "@nextclaw/ncp";
import { isRecord, normalizeString } from "./nextclaw-ncp-message-bridge.js";

type NextclawNcpToolRegistryOptions = {
  bus: MessageBus;
  providerManager: ProviderManager;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  gatewayController?: GatewayController;
  getConfig: () => Config;
  getExtensionRegistry?: () => ExtensionRegistry | undefined;
  getAdditionalTools?: (context: PreparedRunContext) => ReadonlyArray<NcpTool>;
  writeSubagentCompletionToSession?: (params: {
    sessionId: string;
    label: string;
    task: string;
    result: string;
    status: "ok" | "error";
  }) => Promise<void>;
};

type PreparedRunContext = {
  agentId: string;
  channel: string;
  chatId: string;
  config: Config;
  contextTokens: number;
  execTimeoutSeconds: number;
  handoffDepth: number;
  maxTokens?: number;
  metadata: Record<string, unknown>;
  model: string;
  restrictToWorkspace: boolean;
  searchConfig: SearchConfig;
  sessionId: string;
  workspace: string;
};

function toToolParams(args: unknown): Record<string, unknown> {
  if (isRecord(args)) {
    return args;
  }
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args) as unknown;
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function readMetadataAccountId(
  metadata: Record<string, unknown>,
  sessionMetadata: Record<string, unknown>,
): string | undefined {
  const candidates = [
    metadata.accountId,
    metadata.account_id,
    sessionMetadata.last_account_id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

class CoreToolNcpAdapter implements NcpTool {
  constructor(
    private readonly tool: Tool,
    private readonly executeTool: (toolName: string, args: unknown) => Promise<unknown>,
  ) {}

  get name(): string {
    return this.tool.name;
  }

  get description(): string {
    return this.tool.description;
  }

  get parameters(): Record<string, unknown> {
    return this.tool.parameters;
  }

  async execute(args: unknown): Promise<unknown> {
    return this.executeTool(this.tool.name, args);
  }
}

export class NextclawNcpToolRegistry implements NcpToolRegistry {
  private readonly subagents: SubagentManager;
  private registry = new ToolRegistry();
  private readonly tools = new Map<string, NcpTool>();
  private currentExtensionToolContext: {
    config?: Config;
    workspaceDir?: string;
    sessionKey?: string;
    channel?: string;
    chatId?: string;
    sandboxed?: boolean;
  } = {};

  constructor(
    private readonly options: NextclawNcpToolRegistryOptions,
  ) {
    const initialConfig = this.options.getConfig();
    this.subagents = new SubagentManager({
      providerManager: this.options.providerManager,
      workspace: initialConfig.agents.defaults.workspace,
      bus: this.options.bus,
      model: initialConfig.agents.defaults.model,
      contextTokens: initialConfig.agents.defaults.contextTokens,
      searchConfig: initialConfig.search,
      execConfig: initialConfig.tools.exec,
      restrictToWorkspace: initialConfig.tools.restrictToWorkspace,
      completionSink: async (params) => {
        const sessionId = params.origin.sessionKey?.trim();
        if (!sessionId || !this.options.writeSubagentCompletionToSession) {
          return;
        }
        await this.options.writeSubagentCompletionToSession({
          sessionId,
          label: params.label,
          task: params.task,
          result: params.result,
          status: params.status,
        });
      },
    });
  }

  prepareForRun(context: PreparedRunContext): void {
    this.subagents.updateRuntimeOptions({
      model: context.model,
      maxTokens: context.maxTokens,
      contextTokens: context.contextTokens,
      searchConfig: context.searchConfig,
      execConfig: { timeout: context.execTimeoutSeconds },
      restrictToWorkspace: context.restrictToWorkspace,
    });

    this.currentExtensionToolContext = {
      config: context.config,
      workspaceDir: context.workspace,
      sessionKey: context.sessionId,
      channel: context.channel,
      chatId: context.chatId,
      sandboxed: context.restrictToWorkspace,
    };

    this.registry = new ToolRegistry();
    this.tools.clear();

    this.registerDefaultTools(context);
    this.registerExtensionTools(context);
    this.registerAdditionalTools(context);
  }

  listTools(): ReadonlyArray<NcpTool> {
    return [...this.tools.values()].filter((tool) => this.isToolAvailable(tool.name));
  }

  getTool(name: string): NcpTool | undefined {
    if (!this.isToolAvailable(name)) {
      return undefined;
    }
    return this.tools.get(name);
  }

  getToolDefinitions(): ReadonlyArray<NcpToolDefinition> {
    return this.listTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async execute(toolCallId: string, toolName: string, args: unknown): Promise<unknown> {
    if (this.registry.has(toolName)) {
      return this.registry.execute(toolName, toToolParams(args), toolCallId);
    }
    return this.tools.get(toolName)?.execute(args);
  }

  private registerDefaultTools(context: PreparedRunContext): void {
    const allowedDir = context.restrictToWorkspace ? context.workspace : undefined;
    this.registerTool(new ReadFileTool(allowedDir));
    this.registerTool(new WriteFileTool(allowedDir));
    this.registerTool(new EditFileTool(allowedDir));
    this.registerTool(new ListDirTool(allowedDir));

    const execTool = new ExecTool({
      workingDir: context.workspace,
      timeout: context.execTimeoutSeconds,
      restrictToWorkspace: context.restrictToWorkspace,
    });
    execTool.setContext({
      sessionKey: context.sessionId,
      channel: context.channel,
      chatId: context.chatId,
    });
    this.registerTool(execTool);

    this.registerTool(new WebSearchTool(context.searchConfig));
    this.registerTool(new WebFetchTool());
    this.registerMessagingTools(context);

    const spawnTool = new SpawnTool(this.subagents);
    spawnTool.setContext(
      context.channel,
      context.chatId,
      context.model,
      context.sessionId,
      context.agentId,
    );
    this.registerTool(spawnTool);

    this.registerTool(new SessionsListTool(this.options.sessionManager));
    this.registerTool(new SessionsHistoryTool(this.options.sessionManager));
    const sessionsSendTool = new SessionsSendTool(this.options.sessionManager, this.options.bus);
    sessionsSendTool.setContext({
      currentSessionKey: context.sessionId,
      currentAgentId: context.agentId,
      channel: context.channel,
      chatId: context.chatId,
      maxPingPongTurns: context.config.session?.agentToAgent?.maxPingPongTurns ?? 0,
      currentHandoffDepth: context.handoffDepth,
    });
    this.registerTool(sessionsSendTool);

    this.registerTool(new MemorySearchTool(context.workspace));
    this.registerTool(new MemoryGetTool(context.workspace));
    this.registerTool(new SubagentsTool(this.subagents));

    const gatewayTool = new GatewayTool(this.options.gatewayController);
    gatewayTool.setContext({ sessionKey: context.sessionId });
    this.registerTool(gatewayTool);
  }

  private registerMessagingTools(context: PreparedRunContext): void {
    const accountId = readMetadataAccountId(context.metadata, {});
    const messageTool = new MessageTool((message) => this.options.bus.publishOutbound(message));
    messageTool.setContext(context.channel, context.chatId, accountId ?? null);
    this.registerTool(messageTool);
    if (this.options.cronService) {
      const cronTool = new CronTool(this.options.cronService);
      cronTool.setContext(context.channel, context.chatId, accountId ?? null);
      this.registerTool(cronTool);
    }
  }

  private registerExtensionTools(context: PreparedRunContext): void {
    const extensionRegistry = this.options.getExtensionRegistry?.();
    if (!extensionRegistry || extensionRegistry.tools.length === 0) {
      return;
    }

    const seen = new Set<string>(this.registry.toolNames);
    for (const registration of extensionRegistry.tools) {
      for (const alias of registration.names) {
        if (seen.has(alias)) {
          continue;
        }
        seen.add(alias);
        this.registerTool(
          new ExtensionToolAdapter({
            registration,
            alias,
            config: context.config,
            workspaceDir: context.workspace,
            contextProvider: () => this.currentExtensionToolContext,
            diagnostics: extensionRegistry.diagnostics,
          }),
        );
      }
    }
  }

  private registerTool(tool: Tool): void {
    this.registry.register(tool);
    this.tools.set(
      tool.name,
      new CoreToolNcpAdapter(tool, async (toolName, args) => this.registry.execute(toolName, toToolParams(args))),
    );
  }

  private registerAdditionalTools(context: PreparedRunContext): void {
    const tools = this.options.getAdditionalTools?.(context) ?? [];
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        continue;
      }
      this.tools.set(tool.name, tool);
    }
  }

  private isToolAvailable(name: string): boolean {
    const coreTool = this.registry.get(name);
    return coreTool ? coreTool.isAvailable() : true;
  }
}

export function resolveAgentHandoffDepth(metadata: Record<string, unknown>): number {
  const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
  if (!Number.isFinite(rawDepth) || rawDepth < 0) {
    return 0;
  }
  return Math.trunc(rawDepth);
}

export function readAccountIdForHints(
  metadata: Record<string, unknown>,
  sessionMetadata: Record<string, unknown>,
): string | undefined {
  return readMetadataAccountId(metadata, sessionMetadata);
}
