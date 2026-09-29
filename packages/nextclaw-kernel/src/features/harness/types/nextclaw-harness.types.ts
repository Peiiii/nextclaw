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
import type { UserQuestionView } from "@kernel/managers/user-question.manager.js";

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
  channel?: string;
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

export type NextclawUserQuestion = UserQuestionView;
export type NextclawUserQuestionReply = {
  question: NextclawUserQuestion;
  text: string | null;
};

export type NextclawHarnessResources = {
  agents: Pick<import("@kernel/managers/agent.manager.js").AgentManager,
    "getDefaultAgentId" | "getAgent" | "listAgents" | "createAgent">;
  sessionManager: Pick<import("@kernel/managers/session.manager.js").SessionManager,
    "getSession" | "createSession" | "listSessionMessages" | "deleteSession" | "flushSession">;
  sessionRunManager: Pick<import("@kernel/managers/session-run.manager.js").SessionRunManager, "deleteSessionRun">;
  configManager: Pick<import("@kernel/managers/config.manager.js").ConfigManager, "config">;
  userQuestions: Pick<import("@kernel/managers/user-question.manager.js").UserQuestionManager,
    "list" | "resolveAndWaitForReply">;
  eventBus: EventBus;
  ingress: Ingress;
  capabilities: IKernel;
};

export type NextclawHarnessOptions = {
  platform: import("@kernel/types/agent-platform.types.js").AgentPlatform;
  modules?: readonly import("@kernel/types/agent-platform.types.js").AgentKernelModule[];
  allowSlashCommands?: boolean;
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
  channel?: string;
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

export type { IToolRegistry, ContextBlock, ContextProviderRequest, ContextProvider, IContextRegistry, ModelChatInput, IModelRegistry, AgentRuntimeSessionTypeCatalog, IRuntimeRegistry, McpToolCallInput, IMcpRegistry, IKernel } from "@kernel/types/kernel-capability.types.js";
import type { IKernel } from "@kernel/types/kernel-capability.types.js";

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
  delete(sessionId: string): Promise<void>;
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
  prepare(): Promise<void>;
  start(): Promise<void>;
  runTask(input: NextclawTaskInput): Promise<NextclawTaskResult>;
  listSessionMessages(sessionId: string): Promise<NcpMessage[]>;
  listUserQuestions(sessionId: string): Promise<NextclawUserQuestion[]>;
  answerUserQuestion(input: {
    sessionId: string;
    questionId: string;
    action: "answer" | "dismiss";
    answer?: string;
    signal?: AbortSignal;
    onEvent?: (event: NcpEndpointEvent) => void;
    onAssistantDelta?: (delta: string) => void;
  }): Promise<NextclawUserQuestionReply>;
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
