import type {
  NcpContextWindowUpdatedPayload,
  NcpFailedEnvelope,
  NcpCompletedEnvelope,
  NcpMessageAbortPayload,
  NcpMessageSentPayload,
  NcpRunErrorPayload,
  NcpRunFinishedPayload,
  NcpRunMetadataPayload,
  NcpRunStartedPayload,
  NcpToolCallArgsDeltaPayload,
  NcpToolCallArgsPayload,
  NcpToolCallEndPayload,
  NcpToolCallResultPayload,
  NcpToolCallStartPayload,
  NcpToolExecutionStartedPayload,
  NcpReasoningDeltaPayload,
  NcpReasoningEndPayload,
  NcpReasoningStartPayload,
  NcpTextDeltaPayload,
  NcpTextEndPayload,
  NcpTextStartPayload,
} from "../../types/events.types.js";
import type { NcpError } from "../../types/errors.types.js";
import type { NcpMessage } from "../../types/message.js";
import type { NcpRunContext } from "../../types/run.types.js";
import type {
  NcpAgentConversationSnapshot,
  NcpConversationStateManager,
} from "../conversation-state.types.js";

export type NcpAgentConversationHydrationParams = {
  sessionId: string;
  messages: ReadonlyArray<NcpMessage>;
  activeRun?: NcpRunContext | null;
  contextWindow?: Record<string, unknown> | null;
};

/**
 * Agent-scenario state manager: extends the generic conversation state manager
 * with explicit handle methods for each NCP event type that affects agent conversation state.
 *
 * Implementations may route dispatch(event) to the corresponding handleXxx(payload)
 * and use these handlers to update messages, streamingMessage, and error.
 */
export interface NcpAgentConversationStateManager extends NcpConversationStateManager {
  getSnapshot(): NcpAgentConversationSnapshot;
  reset(): void;
  clearError(): void;
  hydrate(payload: NcpAgentConversationHydrationParams): void;
  prependHistory(messages: ReadonlyArray<NcpMessage>): void;
  /** Local peer sent a message (outbound); typically non-streaming. Add to messages. */
  handleMessageSent(payload: NcpMessageSentPayload): void;
  /** Finalize one assistant step without settling the enclosing run. */
  handleMessageCompleted(payload: NcpCompletedEnvelope): void;
  handleMessageAbort(payload: NcpMessageAbortPayload, occurredAt?: string): void;
  handleMessageFailed(payload: NcpFailedEnvelope, occurredAt?: string): void;

  handleMessageTextStart(payload: NcpTextStartPayload): void;
  handleMessageTextDelta(payload: NcpTextDeltaPayload): void;
  handleMessageTextEnd(payload: NcpTextEndPayload): void;

  handleMessageReasoningStart(payload: NcpReasoningStartPayload): void;
  handleMessageReasoningDelta(payload: NcpReasoningDeltaPayload): void;
  handleMessageReasoningEnd(payload: NcpReasoningEndPayload): void;

  handleMessageToolCallStart(payload: NcpToolCallStartPayload): void;
  handleMessageToolCallArgs(payload: NcpToolCallArgsPayload): void;
  handleMessageToolCallArgsDelta(payload: NcpToolCallArgsDeltaPayload): void;
  handleMessageToolCallEnd(payload: NcpToolCallEndPayload): void;
  handleMessageToolExecutionStarted(
    payload: NcpToolExecutionStartedPayload,
    occurredAt?: string,
  ): void;
  handleMessageToolCallResult(payload: NcpToolCallResultPayload, occurredAt?: string): void;

  handleRunStarted(payload: NcpRunStartedPayload, occurredAt?: string): void;
  handleRunFinished(payload: NcpRunFinishedPayload, occurredAt?: string): void;
  handleRunError(payload: NcpRunErrorPayload, occurredAt?: string): void;
  handleRunMetadata(payload: NcpRunMetadataPayload): void;
  handleContextWindowUpdated(payload: NcpContextWindowUpdatedPayload): void;

  handleEndpointError(payload: NcpError, occurredAt?: string): void;
}
