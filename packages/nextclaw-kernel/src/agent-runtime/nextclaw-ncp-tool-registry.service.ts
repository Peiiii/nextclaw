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
  ToolRegistry,
  WebFetchTool,
  WebSearchTool,
  WriteFileTool,
  type Config,
  type CronService,
  type ExtensionRegistry,
  type GatewayController,
  type MessageBus,
  type SearchConfig,
  type SessionManager,
  type SessionRequestManager,
} from "@nextclaw/core";
import type { Tool } from "@nextclaw/core";
import type { NcpTool, NcpToolDefinition, NcpToolRegistry } from "@nextclaw/ncp";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import { isRecord, normalizeString } from "@kernel/utils/ncp-message-bridge.utils.js";
import { SessionRequestTool } from "@kernel/tools/session-request.tools.js";
import { SessionSpawnTool } from "@kernel/tools/session-spawn.tools.js";

type NextclawNcpToolRegistryOptions = {
  bus: MessageBus;
  providerManager: LlmProviderRuntime;
  sessionManager: SessionManager;
  cronService?: CronService | null;
  gatewayController?: GatewayController;
  getConfig: () => Config;
  getExtensionRegistry?: () => ExtensionRegistry | undefined;
  getAdditionalTools?: (context: PreparedRunContext) => ReadonlyArray<NcpTool>;
  onSessionUpdated?: (sessionKey: string) => void;
  sessionRequestManager: SessionRequestManager;
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

  execute = async (args: unknown): Promise<unknown> => {
    return this.executeTool(this.tool.name, args);
  };
}

export class NextclawNcpToolRegistry implements NcpToolRegistry {
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
  ) {}

  prepareForRun = (context: PreparedRunContext): void => {
    const {
      channel,
      chatId,
      config,
      restrictToWorkspace,
      sessionId,
      workspace,
    } = context;
    this.currentExtensionToolContext = {
      config,
      workspaceDir: workspace,
      sessionKey: sessionId,
      channel,
      chatId,
      sandboxed: restrictToWorkspace,
    };

    this.registry = new ToolRegistry();
    this.tools.clear();

    this.registerDefaultTools(context);
    this.registerExtensionTools(context);
    this.registerAdditionalTools(context);
  };

  listTools = (): ReadonlyArray<NcpTool> => {
    return [...this.tools.values()].filter((tool) => this.isToolAvailable(tool.name));
  };

  getTool = (name: string): NcpTool | undefined => {
    if (!this.isToolAvailable(name)) {
      return undefined;
    }
    return this.tools.get(name);
  };

  getToolDefinitions = (): ReadonlyArray<NcpToolDefinition> => {
    return this.listTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  };

  execute = async (toolCallId: string, toolName: string, args: unknown): Promise<unknown> => {
    if (this.registry.has(toolName)) {
      return this.registry.executeRaw(toolName, toToolParams(args), toolCallId);
    }
    return this.tools.get(toolName)?.execute(args);
  };

  private registerDefaultTools = (context: PreparedRunContext): void => {
    const {
      channel,
      chatId,
      execTimeoutSeconds,
      handoffDepth,
      metadata,
      restrictToWorkspace,
      searchConfig,
      sessionId,
      workspace
    } = context;
    const allowedDir = restrictToWorkspace ? workspace : undefined;
    this.registerTool(new ReadFileTool(allowedDir));
    this.registerTool(new WriteFileTool(allowedDir));
    this.registerTool(new EditFileTool(allowedDir));
    this.registerTool(new ListDirTool(allowedDir));

    const execTool = new ExecTool({
      workingDir: workspace,
      timeout: execTimeoutSeconds,
      restrictToWorkspace,
    });
    execTool.setContext({
      sessionKey: sessionId,
      channel,
      chatId,
    });
    this.registerTool(execTool);

    this.registerTool(new WebSearchTool(searchConfig));
    this.registerTool(new WebFetchTool());
    this.registerMessagingTools({ channel, chatId, metadata });

    const sessionsSpawnTool = new SessionSpawnTool(
      this.options.sessionManager,
      this.options.sessionRequestManager,
      this.options.onSessionUpdated,
    );
    sessionsSpawnTool.setContext({
      sourceSessionId: sessionId,
      sourceSessionMetadata: metadata,
      handoffDepth,
    });
    this.registerTool(sessionsSpawnTool);

    const sessionsRequestTool = new SessionRequestTool(
      this.options.sessionRequestManager,
    );
    sessionsRequestTool.setContext({
      sourceSessionId: sessionId,
      handoffDepth,
    });
    this.registerTool(sessionsRequestTool);

    this.registerTool(new SessionsListTool(this.options.sessionManager));
    this.registerTool(new SessionsHistoryTool(this.options.sessionManager));

    this.registerTool(new MemorySearchTool(workspace));
    this.registerTool(new MemoryGetTool(workspace));

    const gatewayTool = new GatewayTool(this.options.gatewayController);
    gatewayTool.setContext({ sessionKey: sessionId });
    this.registerTool(gatewayTool);
  };

  private registerMessagingTools = (context: Pick<PreparedRunContext, "channel" | "chatId" | "metadata">): void => {
    const { channel, chatId, metadata } = context;
    const accountId = readMetadataAccountId(metadata, {});
    const messageTool = new MessageTool((message) => this.options.bus.publishOutbound(message));
    messageTool.setContext(channel, chatId, accountId ?? null);
    this.registerTool(messageTool);
    if (this.options.cronService) {
      const cronTool = new CronTool(this.options.cronService);
      cronTool.setContext(channel, chatId, accountId ?? null);
      this.registerTool(cronTool);
    }
  };

  private registerExtensionTools = (context: PreparedRunContext): void => {
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
  };

  private registerTool = (tool: Tool): void => {
    this.registry.register(tool);
    this.tools.set(
      tool.name,
      new CoreToolNcpAdapter(tool, async (toolName, args) => this.registry.execute(toolName, toToolParams(args))),
    );
  };

  private registerAdditionalTools = (context: PreparedRunContext): void => {
    const tools = this.options.getAdditionalTools?.(context) ?? [];
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        continue;
      }
      this.tools.set(tool.name, tool);
    }
  };

  private isToolAvailable = (name: string): boolean => {
    const coreTool = this.registry.get(name);
    return coreTool ? coreTool.isAvailable() : true;
  };
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
