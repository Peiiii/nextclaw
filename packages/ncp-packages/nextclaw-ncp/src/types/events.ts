import type { OpenAITool } from "../agent-runtime/llm-api.js";
import type { NcpError } from "./errors.js";
import type { NcpMessage, NcpToolOutputContentItem } from "./message.js";

/**
 * NCP event and payload definitions.
 *
 * Streaming content (text, reasoning, tool args) uses start → delta sequence → end.
 * The same content can be sent as a single full event (e.g. message.incoming or message.completed)
 * instead; endpoints or upper layers choose as needed.
 */

// ---------------------------------------------------------------------------
// Message envelopes (used by request/incoming/completed/failed)
// ---------------------------------------------------------------------------

export type NcpRequestEnvelope = {
  sessionId: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  providerRoute?: NcpProviderRuntimeRoute;
  tools?: ReadonlyArray<OpenAITool>;
};

export type NcpProviderRuntimeRoute = {
  model: string;
  apiKey?: string | null;
  apiBase?: string | null;
  headers: Record<string, string>;
};

/** Payload for message.incoming: message content from the other peer (partial or full). */
export type NcpResponseEnvelope = {
  sessionId: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpCompletedEnvelope = {
  sessionId: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpFailedEnvelope = {
  sessionId: string;
  messageId?: string;
  error: NcpError;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpMessageAcceptedPayload = {
  messageId: string;
  correlationId?: string;
  transportId?: string;
};

/** Payload for message.abort: identifies which session's active execution to cancel. */
export type NcpMessageAbortPayload = {
  sessionId: string;
  messageId?: string;
};

/**
 * Payload for message.stream-request: attach to the live event stream of a session.
 * Used when reconnecting during an active response or attaching another live reader.
 */
export type NcpStreamRequestPayload = {
  sessionId: string;
  metadata?: Record<string, unknown>;
};

/**
 * Payload for message.sent: the local peer has sent a message (outbound).
 * Typically non-streaming; add the message to the local conversation state.
 */
export type NcpMessageSentPayload = {
  sessionId: string;
  message: NcpMessage;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// IM: typing indicator (user or bot)
// ---------------------------------------------------------------------------

export type NcpTypingStartPayload = {
  sessionId: string;
  /** Participant who is typing (human user or bot/assistant). */
  userId?: string;
};

export type NcpTypingEndPayload = {
  sessionId: string;
  /** Participant who stopped typing (human user or bot/assistant). */
  userId?: string;
};

// ---------------------------------------------------------------------------
// IM: presence (online/offline/away)
// ---------------------------------------------------------------------------

export type NcpPresenceUpdatedPayload = {
  sessionId: string;
  /** Participant this presence applies to (human user or bot/assistant). */
  userId?: string;
  status: "online" | "offline" | "away";
};

// ---------------------------------------------------------------------------
// IM: read receipt, delivery receipt, recall, reaction
// ---------------------------------------------------------------------------

export type NcpMessageReadPayload = {
  sessionId: string;
  messageId: string;
  readAt?: string;
  readerId?: string;
};

export type NcpMessageDeliveredPayload = {
  sessionId: string;
  messageId: string;
};

export type NcpMessageRecalledPayload = {
  sessionId: string;
  messageId: string;
};

export type NcpMessageReactionPayload = {
  sessionId: string;
  messageId: string;
  reaction: string;
  added: boolean;
  /** Participant who added or removed the reaction (human user or bot/assistant). */
  userId?: string;
};

// ---------------------------------------------------------------------------
// Run lifecycle (aligned with agent-chat RUN_*)
// ---------------------------------------------------------------------------

export type NcpRunStartedPayload = {
  sessionId?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunFinishedPayload = {
  sessionId?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunErrorPayload = {
  sessionId?: string;
  messageId?: string;
  error?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunMetadataPayload = {
  sessionId?: string;
  messageId?: string;
  runId?: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Text stream (aligned with agent-chat TEXT_*)
// Streaming: text-start → text-delta sequence → text-end. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpTextStartPayload = {
  sessionId: string;
  messageId: string;
};

export type NcpTextDeltaPayload = {
  sessionId: string;
  messageId: string;
  delta: string;
};

export type NcpTextEndPayload = {
  sessionId: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Reasoning stream (aligned with agent-chat REASONING_*)
// Streaming: reasoning-start → reasoning-delta sequence → reasoning-end. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpReasoningStartPayload = {
  sessionId: string;
  messageId: string;
};

export type NcpReasoningDeltaPayload = {
  sessionId: string;
  messageId: string;
  delta: string;
};

export type NcpReasoningEndPayload = {
  sessionId: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Tool call stream (aligned with agent-chat TOOL_CALL_*)
// Streaming: tool-call-start → tool-call-args or tool-call-args-delta sequence → tool-call-end; then tool-call-result. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpToolCallStartPayload = {
  sessionId: string;
  messageId?: string;
  toolCallId: string;
  toolName: string;
};

export type NcpToolCallArgsPayload = {
  sessionId: string;
  toolCallId: string;
  args: string;
};

export type NcpToolCallArgsDeltaPayload = {
  sessionId: string;
  messageId?: string;
  toolCallId: string;
  delta: string;
};

export type NcpToolCallEndPayload = {
  sessionId: string;
  toolCallId: string;
};

export type NcpToolCallResultPayload = {
  sessionId: string;
  toolCallId: string;
  content: unknown;
  contentItems?: NcpToolOutputContentItem[];
};

// ---------------------------------------------------------------------------
// Event type enum
// ---------------------------------------------------------------------------

export enum NcpEventType {
  EndpointReady = "endpoint.ready",
  EndpointError = "endpoint.error",
  MessageRequest = "message.request",
  MessageStreamRequest = "message.stream-request",
  MessageSent = "message.sent",
  MessageAccepted = "message.accepted",
  MessageIncoming = "message.incoming",
  MessageCompleted = "message.completed",
  MessageFailed = "message.failed",
  MessageAbort = "message.abort",
  MessageTextStart = "message.text-start",
  MessageTextDelta = "message.text-delta",
  MessageTextEnd = "message.text-end",
  MessageReasoningStart = "message.reasoning-start",
  MessageReasoningDelta = "message.reasoning-delta",
  MessageReasoningEnd = "message.reasoning-end",
  MessageToolCallStart = "message.tool-call-start",
  MessageToolCallArgs = "message.tool-call-args",
  MessageToolCallArgsDelta = "message.tool-call-args-delta",
  MessageToolCallEnd = "message.tool-call-end",
  MessageToolCallResult = "message.tool-call-result",
  MessageRead = "message.read",
  MessageDelivered = "message.delivered",
  MessageRecalled = "message.recalled",
  MessageReaction = "message.reaction",
  RunStarted = "run.started",
  RunFinished = "run.finished",
  RunError = "run.error",
  RunMetadata = "run.metadata",
  TypingStart = "typing.start",
  TypingEnd = "typing.end",
  PresenceUpdated = "presence.updated",
}

// ---------------------------------------------------------------------------
// Event union (aligned with agent-chat EventType + endpoint lifecycle)
// ---------------------------------------------------------------------------

export type NcpEndpointEvent =
  | { type: NcpEventType.EndpointReady }
  | { type: NcpEventType.MessageRequest; payload: NcpRequestEnvelope }
  | { type: NcpEventType.MessageStreamRequest; payload: NcpStreamRequestPayload }
  | { type: NcpEventType.MessageSent; payload: NcpMessageSentPayload }
  | { type: NcpEventType.MessageAccepted; payload: NcpMessageAcceptedPayload }
  | { type: NcpEventType.MessageIncoming; payload: NcpResponseEnvelope }
  | { type: NcpEventType.MessageCompleted; payload: NcpCompletedEnvelope }
  | { type: NcpEventType.MessageFailed; payload: NcpFailedEnvelope }
  | { type: NcpEventType.MessageAbort; payload: NcpMessageAbortPayload }
  | { type: NcpEventType.EndpointError; payload: NcpError }
  | { type: NcpEventType.RunStarted; payload: NcpRunStartedPayload }
  | { type: NcpEventType.RunFinished; payload: NcpRunFinishedPayload }
  | { type: NcpEventType.RunError; payload: NcpRunErrorPayload }
  | { type: NcpEventType.RunMetadata; payload: NcpRunMetadataPayload }
  | { type: NcpEventType.MessageTextStart; payload: NcpTextStartPayload }
  | { type: NcpEventType.MessageTextDelta; payload: NcpTextDeltaPayload }
  | { type: NcpEventType.MessageTextEnd; payload: NcpTextEndPayload }
  | { type: NcpEventType.MessageReasoningStart; payload: NcpReasoningStartPayload }
  | { type: NcpEventType.MessageReasoningDelta; payload: NcpReasoningDeltaPayload }
  | { type: NcpEventType.MessageReasoningEnd; payload: NcpReasoningEndPayload }
  | { type: NcpEventType.MessageToolCallStart; payload: NcpToolCallStartPayload }
  | { type: NcpEventType.MessageToolCallArgs; payload: NcpToolCallArgsPayload }
  | { type: NcpEventType.MessageToolCallArgsDelta; payload: NcpToolCallArgsDeltaPayload }
  | { type: NcpEventType.MessageToolCallEnd; payload: NcpToolCallEndPayload }
  | { type: NcpEventType.MessageToolCallResult; payload: NcpToolCallResultPayload }
  | { type: NcpEventType.TypingStart; payload: NcpTypingStartPayload }
  | { type: NcpEventType.TypingEnd; payload: NcpTypingEndPayload }
  | { type: NcpEventType.PresenceUpdated; payload: NcpPresenceUpdatedPayload }
  | { type: NcpEventType.MessageRead; payload: NcpMessageReadPayload }
  | { type: NcpEventType.MessageDelivered; payload: NcpMessageDeliveredPayload }
  | { type: NcpEventType.MessageRecalled; payload: NcpMessageRecalledPayload }
  | { type: NcpEventType.MessageReaction; payload: NcpMessageReactionPayload };

export type NcpEndpointSubscriber = (event: NcpEndpointEvent) => void;
