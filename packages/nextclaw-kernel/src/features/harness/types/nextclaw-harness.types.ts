import type {
  LLMResponse,
  LLMStreamEvent,
  McpServerDefinition,
  ProviderCatalogPlugin,
  ProviderSpec,
  ThinkingLevel,
} from "@nextclaw/core";
import type {
  McpCatalogFilter,
  McpServerRecord,
  McpToolCatalogEntry,
} from "@nextclaw/mcp";
import type { NcpEndpointEvent, NcpMessage, NcpTool } from "@nextclaw/ncp";
import type { Disposer, EventBus, Ingress } from "@nextclaw/shared";
import type {
  AgentRuntimeEntry,
  AgentRuntimeProviderRegistration,
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeOption,
} from "@kernel/features/runtime-registry/index.js";
import type { Contribution } from "@kernel/features/harness/managers/nextclaw-contribution.manager.js";

export type NextclawHarnessErrorCode =
  | "invalid_input"
  | "cancelled"
  | "lifecycle"
  | "runtime_failure";

export class NextclawHarnessError extends Error {
  readonly code: NextclawHarnessErrorCode;
  readonly cause?: unknown;

  constructor(
    code: NextclawHarnessErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "NextclawHarnessError";
    this.code = code;
    this.cause = cause;
  }
}

export type NextclawTaskInput = {
  input: string;
  agentId?: string;
  sessionId?: string;
  model?: string;
  signal?: AbortSignal;
  onEvent?: (event: NcpEndpointEvent) => void;
  onAssistantDelta?: (delta: string) => void;
};

export type NextclawTaskResult = {
  schemaVersion: "nextclaw.task/v1";
  status: "completed";
  kind: "agent" | "command";
  agentId: string;
  sessionId: string;
  runId: string | null;
  text: string;
  completedMessage: NcpMessage | null;
};

export type NextclawHarnessOptions = {
  homeDir?: string;
  configPath?: string;
  builtInAppsDirectory?: string;
  productVersion?: string;
  productActivitySink?: {
    record: (signal: {
      kind: "intent_accepted" | "run_succeeded";
      occurredAt: string;
      source: "direct" | "channel";
    }) => Promise<void> | void;
  };
};

export type NextclawAgentDefinition = {
  id: string;
  displayName?: string;
  description?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
};

export type NextclawSessionCreateInput = {
  sessionId?: string;
  task: string;
  title?: string;
  workspace?: string;
  model?: string;
};

export type NextclawSessionRunInput = {
  input: string;
  model?: string;
  signal?: AbortSignal;
  onEvent?: (event: NcpEndpointEvent) => void;
  onAssistantDelta?: (delta: string) => void;
};

export type NextclawRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type NextclawContributionDescriptor = {
  id: string;
  version?: string;
};

export interface IToolRegistry {
  register(tool: NcpTool): Disposer;
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

export interface INextclawContributionRegistry {
  register(contribution: Contribution): Disposer;
  list(): readonly NextclawContributionDescriptor[];
}

export interface INextclawRun {
  readonly agentId: string;
  readonly runId: string | null;
  readonly sessionId: string;
  readonly status: NextclawRunStatus;
  events(): AsyncIterable<NcpEndpointEvent>;
  result(): Promise<NextclawTaskResult>;
  cancel(): Promise<void>;
}

export interface INextclawSession {
  readonly agentId: string;
  readonly sessionId: string;
  run(input: NextclawSessionRunInput): Promise<INextclawRun>;
}

export interface INextclawAgentSessions {
  create(input: NextclawSessionCreateInput): Promise<INextclawSession>;
  resume(sessionId: string): Promise<INextclawSession>;
}

export interface INextclawSessionRegistry {
  resume(sessionId: string): Promise<INextclawSession>;
}

export interface INextclawAgent {
  readonly definition: NextclawAgentDefinition;
  readonly id: string;
  readonly sessions: INextclawAgentSessions;
}

export interface INextclawAgentRegistry {
  create(definition: NextclawAgentDefinition): Promise<INextclawAgent>;
  get(agentId?: string): INextclawAgent;
  list(): readonly NextclawAgentDefinition[];
}

export interface INextclawHarness {
  readonly agents: INextclawAgentRegistry;
  readonly sessions: INextclawSessionRegistry;
  readonly contributions: INextclawContributionRegistry;
  start(): Promise<void>;
  runTask(input: NextclawTaskInput): Promise<NextclawTaskResult>;
  dispose(): Promise<void>;
}

export type { Disposer } from "@nextclaw/shared";
export type {
  AgentRuntimeEntry,
  AgentRuntimeProviderRegistration,
  AgentRuntimeSessionTypeDescribeParams,
  AgentRuntimeSessionTypeOption,
} from "@kernel/features/runtime-registry/index.js";
export type {
  LLMResponse,
  LLMStreamEvent,
  McpServerDefinition,
  ProviderCatalogPlugin,
  ProviderSpec,
} from "@nextclaw/core";
export type {
  McpCatalogFilter,
  McpServerRecord,
  McpToolCatalogEntry,
} from "@nextclaw/mcp";
