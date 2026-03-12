import type { NcpError } from "./errors.js";
import type { NcpMessage } from "./message.js";

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
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/** Payload for message.incoming: message content from the other peer (partial or full). */
export type NcpResponseEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpCompletedEnvelope = {
  sessionKey: string;
  message: NcpMessage;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type NcpFailedEnvelope = {
  sessionKey: string;
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

/** Payload for message.abort: identifies which request or run to cancel. */
export type NcpMessageAbortPayload = {
  messageId?: string;
  correlationId?: string;
  runId?: string;
};

/**
 * Payload for message.resume-request: resume an existing run by its remote id.
 * Used when reconnecting to a stream (e.g. after page refresh).
 */
export type NcpResumeRequestPayload = {
  sessionKey: string;
  remoteRunId: string;
  fromEventIndex?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Payload for message.sent: the local peer has sent a message (outbound).
 * Typically non-streaming; add the message to the local conversation state.
 */
export type NcpMessageSentPayload = {
  sessionKey: string;
  message: NcpMessage;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// IM: typing indicator (user or bot)
// ---------------------------------------------------------------------------

export type NcpTypingStartPayload = {
  sessionKey: string;
  /** Participant who is typing (human user or bot/assistant). */
  userId?: string;
};

export type NcpTypingEndPayload = {
  sessionKey: string;
  /** Participant who stopped typing (human user or bot/assistant). */
  userId?: string;
};

// ---------------------------------------------------------------------------
// IM: presence (online/offline/away)
// ---------------------------------------------------------------------------

export type NcpPresenceUpdatedPayload = {
  sessionKey: string;
  /** Participant this presence applies to (human user or bot/assistant). */
  userId?: string;
  status: "online" | "offline" | "away";
};

// ---------------------------------------------------------------------------
// IM: read receipt, delivery receipt, recall, reaction
// ---------------------------------------------------------------------------

export type NcpMessageReadPayload = {
  sessionKey: string;
  messageId: string;
  readAt?: string;
  readerId?: string;
};

export type NcpMessageDeliveredPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpMessageRecalledPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpMessageReactionPayload = {
  sessionKey: string;
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
  sessionKey?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunFinishedPayload = {
  sessionKey?: string;
  messageId?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunErrorPayload = {
  sessionKey?: string;
  messageId?: string;
  error?: string;
  threadId?: string;
  runId?: string;
};

export type NcpRunMetadataPayload = {
  sessionKey?: string;
  messageId?: string;
  runId?: string;
  metadata: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Text stream (aligned with agent-chat TEXT_*)
// Streaming: text-start → text-delta sequence → text-end. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpTextStartPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpTextDeltaPayload = {
  sessionKey: string;
  messageId: string;
  delta: string;
};

export type NcpTextEndPayload = {
  sessionKey: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Reasoning stream (aligned with agent-chat REASONING_*)
// Streaming: reasoning-start → reasoning-delta sequence → reasoning-end. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpReasoningStartPayload = {
  sessionKey: string;
  messageId: string;
};

export type NcpReasoningDeltaPayload = {
  sessionKey: string;
  messageId: string;
  delta: string;
};

export type NcpReasoningEndPayload = {
  sessionKey: string;
  messageId: string;
};

// ---------------------------------------------------------------------------
// Tool call stream (aligned with agent-chat TOOL_CALL_*)
// Streaming: tool-call-start → tool-call-args or tool-call-args-delta sequence → tool-call-end; then tool-call-result. Alternative: message.incoming / message.completed with full NcpMessage.
// ---------------------------------------------------------------------------

export type NcpToolCallStartPayload = {
  sessionKey: string;
  messageId?: string;
  toolCallId: string;
  toolName: string;
};

export type NcpToolCallArgsPayload = {
  sessionKey: string;
  toolCallId: string;
  args: string;
};

export type NcpToolCallArgsDeltaPayload = {
  sessionKey: string;
  messageId?: string;
  toolCallId: string;
  delta: string;
};

export type NcpToolCallEndPayload = {
  sessionKey: string;
  toolCallId: string;
};

export type NcpToolCallResultPayload = {
  sessionKey: string;
  toolCallId: string;
  content: unknown;
};

// ---------------------------------------------------------------------------
// Event union (aligned with agent-chat EventType + endpoint lifecycle)
// ---------------------------------------------------------------------------

export type NcpEndpointEvent =
  | { type: "endpoint.ready" }
  | { type: "message.request"; payload: NcpRequestEnvelope }
  | { type: "message.resume-request"; payload: NcpResumeRequestPayload }
  | { type: "message.sent"; payload: NcpMessageSentPayload }
  | { type: "message.accepted"; payload: NcpMessageAcceptedPayload }
  | { type: "message.incoming"; payload: NcpResponseEnvelope }
  | { type: "message.completed"; payload: NcpCompletedEnvelope }
  | { type: "message.failed"; payload: NcpFailedEnvelope }
  | { type: "message.abort"; payload: NcpMessageAbortPayload }
  | { type: "endpoint.error"; payload: NcpError }
  | { type: "run.started"; payload: NcpRunStartedPayload }
  | { type: "run.finished"; payload: NcpRunFinishedPayload }
  | { type: "run.error"; payload: NcpRunErrorPayload }
  | { type: "run.metadata"; payload: NcpRunMetadataPayload }
  | { type: "message.text-start"; payload: NcpTextStartPayload }
  | { type: "message.text-delta"; payload: NcpTextDeltaPayload }
  | { type: "message.text-end"; payload: NcpTextEndPayload }
  | { type: "message.reasoning-start"; payload: NcpReasoningStartPayload }
  | { type: "message.reasoning-delta"; payload: NcpReasoningDeltaPayload }
  | { type: "message.reasoning-end"; payload: NcpReasoningEndPayload }
  | { type: "message.tool-call-start"; payload: NcpToolCallStartPayload }
  | { type: "message.tool-call-args"; payload: NcpToolCallArgsPayload }
  | { type: "message.tool-call-args-delta"; payload: NcpToolCallArgsDeltaPayload }
  | { type: "message.tool-call-end"; payload: NcpToolCallEndPayload }
  | { type: "message.tool-call-result"; payload: NcpToolCallResultPayload }
  | { type: "typing.start"; payload: NcpTypingStartPayload }
  | { type: "typing.end"; payload: NcpTypingEndPayload }
  | { type: "presence.updated"; payload: NcpPresenceUpdatedPayload }
  | { type: "message.read"; payload: NcpMessageReadPayload }
  | { type: "message.delivered"; payload: NcpMessageDeliveredPayload }
  | { type: "message.recalled"; payload: NcpMessageRecalledPayload }
  | { type: "message.reaction"; payload: NcpMessageReactionPayload };

export type NcpEndpointSubscriber = (event: NcpEndpointEvent) => void;
