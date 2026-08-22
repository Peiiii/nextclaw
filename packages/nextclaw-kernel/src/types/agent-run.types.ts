import type {
  NcpError,
  NcpInputDelivery,
  NcpMessage,
  NcpResolvedInputDelivery,
  NcpTool,
} from "@nextclaw/ncp";

export type ThinkingEffort = string;

export type ContextBlock = string;

export type AgentRunRequest = {
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
  thinkingEffort?: ThinkingEffort | null;
  delivery?: NcpInputDelivery;
  idempotencyKey?: string;
};

export type AgentRunAbortRequest = {
  sessionId: string;
  runId?: string;
  correlationId?: string;
  reason?: NcpError;
};

export type AgentRunEditMessageRequest = {
  correlationId?: string;
  message: NcpMessage;
  messageId: string;
  sessionId: string;
};

export type AgentRunContinueRequest = {
  correlationId?: string;
  sessionId: string;
};

export type AgentRunAccepted = {
  sessionId: string;
  userMessageId: string;
  runId: string | null;
  correlationId?: string;
  delivery: NcpResolvedInputDelivery;
};

export type SessionQueuedInput = {
  id: string;
  sessionId: string;
  enqueuedAt: string;
  message: NcpMessage;
  metadata: Record<string, unknown>;
};

export type SessionPendingInput = SessionQueuedInput & {
  placement: "queued" | "steering";
  intendedRunId: string | null;
};

export type SessionSteerQueuedInputResult =
  | { ok: true; input: SessionPendingInput }
  | { ok: false; reason: "not-found" | "unavailable" };

export type AgentRunSpec = {
  runId: string;
  runtimeId: string;
  agentId: string;
  model: string;
  requestedModel: string | null;
  maxTokens?: number;
  thinkingEffort?: ThinkingEffort | null;
  correlationId?: string;
};

export type ContextProvider = {
  provide: (
    request: AgentRunRequest,
  ) => Promise<readonly ContextBlock[]> | readonly ContextBlock[];
};

export type ToolProvider = {
  provide: (
    request: AgentRunRequest,
  ) => Promise<readonly NcpTool[]> | readonly NcpTool[];
};
