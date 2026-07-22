import { randomUUID } from "node:crypto";
import {
  CHAT_SESSION_MATERIALIZATION_METADATA_KEY,
  type AgentRunSendIngressPayload,
  type AgentRunSessionMaterializationMetadata,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import type {
  AgentRunAccepted,
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import {
  AGENT_RUN_EXECUTION_METADATA,
  type AgentRunMessageRunSpecMetadata,
  type AgentRunModelSource,
} from "@kernel/utils/agent-run-execution-metadata.utils.js";
import { AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY } from "@kernel/utils/agent-run-metadata.utils.js";

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function toAgentRunRequest(
  envelope: AgentRunSendIngressPayload,
): AgentRunRequest {
  const metadata = envelope.metadata ?? {};
  const peerId = readOptionalString(envelope.peerId);
  const requestMetadata = {
    agentRuntimeId: metadata.agentRuntimeId,
    agentId: metadata.agentId,
    projectRoot: metadata.projectRoot,
    channel: metadata.channel,
    correlationId: envelope.correlationId,
    metadata: structuredClone(metadata),
    model: metadata.model,
    maxTokens: metadata.maxTokens,
    thinkingEffort: metadata.thinkingEffort,
  };
  if (Array.isArray(envelope.content)) {
    const sessionId = readOptionalString(envelope.sessionId);
    if (sessionId && peerId) {
      throw new Error("agent-run.send cannot accept both sessionId and peerId.");
    }
    return {
      ...requestMetadata,
      sessionId,
      peerId,
      message: {
        sessionId: sessionId ?? "",
        id: `user-message-${randomUUID()}`,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: structuredClone(envelope.content),
      },
    };
  }
  const sourceMessage = envelope.message;
  if (!sourceMessage) {
    throw new Error("Invalid agent run send request.");
  }
  const envelopeSessionId = readOptionalString(envelope.sessionId);
  const messageSessionId = readOptionalString(sourceMessage.sessionId);
  const sessionId = envelopeSessionId ?? messageSessionId;
  if (sessionId && peerId) {
    throw new Error("agent-run.send cannot accept both sessionId and peerId.");
  }
  return {
    ...requestMetadata,
    sessionId,
    peerId,
    message: {
      ...sourceMessage,
      sessionId: sessionId ?? "",
      id: sourceMessage.id ?? `user-message-${randomUUID()}`,
      role: sourceMessage.role ?? "user",
      status: sourceMessage.status ?? "final",
      timestamp: sourceMessage.timestamp ?? new Date().toISOString(),
      parts: structuredClone(sourceMessage.parts),
    },
  };
}

export function createCompletedAssistantMessageEvent(params: {
  sessionId: string;
  message: NcpMessage;
  correlationId?: string;
}): NcpEndpointEvent {
  return {
    occurredAt: new Date().toISOString(),
    type: NcpEventType.MessageCompleted,
    payload: {
      sessionId: params.sessionId,
      message: params.message,
      correlationId: params.correlationId,
    },
  };
}

export function createMessageSentEvent(params: {
  sessionId: string;
  message: NcpMessage;
  correlationId?: string;
}): NcpEndpointEvent {
  return {
    occurredAt: new Date().toISOString(),
    type: NcpEventType.MessageSent,
    payload: {
      sessionId: params.sessionId,
      message: params.message,
      correlationId: params.correlationId,
    },
  };
}

export function createSyntheticRunErrorEvent(params: {
  error: unknown;
  runId: string;
  sessionId: string;
  correlationId?: string;
  startedAt: string;
}): NcpEndpointEvent {
  const {
    correlationId,
    error,
    runId,
    sessionId,
    startedAt,
  } = params;
  const endedAt = new Date().toISOString();
  return {
    occurredAt: endedAt,
    type: NcpEventType.RunError,
    payload: {
      error: error instanceof Error ? error.message : String(error),
      runId,
      sessionId,
      correlationId,
      startedAt,
      endedAt,
    },
  };
}

export function readSessionMaterialization(
  metadata: Record<string, unknown>,
): AgentRunSessionMaterializationMetadata | null {
  const value = metadata[CHAT_SESSION_MATERIALIZATION_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const materialization = value as Partial<AgentRunSessionMaterializationMetadata>;
  if (materialization.kind !== "child") {
    throw new Error("session_materialization.kind must be \"child\".");
  }
  const parentSessionId = readOptionalString(materialization.parentSessionId);
  if (!parentSessionId) {
    throw new Error("session_materialization.parentSessionId is required.");
  }
  if (materialization.inheritContext !== true) {
    throw new Error("session_materialization.inheritContext must be true.");
  }
  return {
    kind: "child",
    parentSessionId,
    inheritContext: true,
  };
}

export function toRunHandle(accepted: AgentRunAccepted): NcpRunHandle {
  return {
    sessionId: accepted.sessionId,
    userMessageId: accepted.userMessageId,
    assistantMessageId: null,
    runId: accepted.runId,
    correlationId: accepted.correlationId,
  };
}

export function findCompletedAssistantMessage(
  messages: readonly NcpMessage[],
  messageId?: string,
): NcpMessage | null {
  return (
    [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.status === "final" &&
          (!messageId || message.id === messageId),
      ) ?? null
  );
}

export function readMessageTask(message: NcpMessage): string {
  return (
    message.parts.flatMap((part) =>
      (part.type === "text" ||
        part.type === "rich-text" ||
        part.type === "reasoning") &&
      part.text.trim()
        ? [part.text.trim()]
        : [],
    )[0] ?? "Session"
  );
}

export function resolveRunSpec(params: {
  defaultAgentId: string;
  model: string;
  modelMaxTokens?: number;
  request: AgentRunRequest;
  runId: string;
  session: AgentRunSession;
}): { modelSource: AgentRunModelSource; spec: AgentRunSpec } {
  const {
    defaultAgentId,
    model,
    modelMaxTokens,
    request,
    runId,
    session,
  } = params;
  const modelSource = request.model !== undefined
    ? "request"
    : session.model !== undefined
      ? "session"
      : "default";
  return {
    modelSource,
    spec: {
      runId,
      runtimeId: session.agentRuntimeId,
      agentId: request.agentId ?? session.agentId ?? defaultAgentId,
      model,
      requestedModel: request.model ?? null,
      maxTokens: request.maxTokens ?? modelMaxTokens,
      thinkingEffort: request.thinkingEffort ?? session.thinkingEffort ?? null,
      correlationId: request.correlationId,
    },
  };
}

export function attachRunSpecMetadata(params: {
  message: NcpMessage;
  modelSource: AgentRunModelSource;
  request: AgentRunRequest;
  session: AgentRunSession;
  spec: AgentRunSpec;
  startedAt: string;
}): NcpMessage {
  const { message, modelSource, request, session, spec, startedAt } = params;
  const metadata = structuredClone(message.metadata ?? {});
  const runSpec: AgentRunMessageRunSpecMetadata = {
    version: 1,
    runId: spec.runId,
    startedAt,
    sessionId: session.sessionId,
    agentRuntimeId: session.agentRuntimeId,
    agentId: spec.agentId,
    model: spec.model,
    modelSource,
    requestedModel: request.model ?? null,
    maxTokens: spec.maxTokens,
    thinkingEffort: spec.thinkingEffort,
    projectRoot: request.projectRoot ?? session.projectRoot ?? null,
    workingDir: session.workingDir ?? null,
    correlationId: spec.correlationId ?? null,
    execution: structuredClone(AGENT_RUN_EXECUTION_METADATA),
  };
  metadata[AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY] = runSpec;
  return {
    ...message,
    metadata,
  };
}
