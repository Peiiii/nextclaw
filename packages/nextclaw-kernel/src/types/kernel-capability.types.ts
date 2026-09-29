import type { LLMResponse, LLMStreamEvent, McpServerDefinition, ProviderCatalogPlugin, ProviderSpec, ThinkingLevel } from "@nextclaw/core";
import type { McpCatalogFilter, McpServerRecord, McpToolCatalogEntry } from "@nextclaw/mcp";
import type { NcpMessage, NcpTool } from "@nextclaw/ncp";
import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import type { Disposer, EventBus, Ingress } from "@nextclaw/shared";
import type { AgentRuntimeEntry, AgentRuntimeProviderRegistration, AgentRuntimeSessionTypeDescribeParams, AgentRuntimeSessionTypeOption } from "@kernel/features/runtime-registry/index.js";

export interface IToolRegistry {
  register(tool: NcpTool): Disposer;
  registerProvider(provider: ToolProvider): Disposer;
}

export type ContextBlock = string;

export type ContextProviderRequest = {
  sessionId?: string;
  peerId?: string;
  message: NcpMessage;
  agentRuntimeId?: string;
  agentId?: string;
  projectRoot?: string;
  channel?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
  thinkingEffort?: string | null;
};

export type ContextProvider = {
  provide: (
    request: ContextProviderRequest,
  ) => Promise<readonly ContextBlock[]> | readonly ContextBlock[];
};

export interface IContextRegistry {
  register(provider: ContextProvider): Disposer;
}

export type ModelChatInput = {
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string | null;
  maxTokens?: number;
  thinkingLevel?: ThinkingLevel | null;
  signal?: AbortSignal;
};

export interface IModelRegistry {
  registerProvider(plugin: ProviderCatalogPlugin): Disposer;
  listProviders(): readonly ProviderSpec[];
  chat(input: ModelChatInput): Promise<LLMResponse>;
  chatStream(input: ModelChatInput): AsyncIterable<LLMStreamEvent>;
}

export type AgentRuntimeSessionTypeCatalog = {
  defaultType: string;
  options: AgentRuntimeSessionTypeOption[];
};

export interface IRuntimeRegistry {
  registerProvider(provider: AgentRuntimeProviderRegistration): Disposer;
  registerEntry(entry: AgentRuntimeEntry): Disposer;
  listSessionTypes(
    params?: AgentRuntimeSessionTypeDescribeParams,
  ): Promise<AgentRuntimeSessionTypeCatalog>;
}

export type McpToolCallInput = {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  signal?: AbortSignal;
};

export interface IMcpRegistry {
  registerServer(
    name: string,
    definition: McpServerDefinition,
  ): Promise<Disposer>;
  listServers(): readonly McpServerRecord[];
  listTools(filter?: McpCatalogFilter): readonly McpToolCatalogEntry[];
  callTool(input: McpToolCallInput): Promise<unknown>;
}

export interface IKernel {
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
  readonly tools: IToolRegistry;
  readonly context: IContextRegistry;
  readonly models: IModelRegistry;
  readonly runtimes: IRuntimeRegistry;
  readonly mcp: IMcpRegistry;
}
