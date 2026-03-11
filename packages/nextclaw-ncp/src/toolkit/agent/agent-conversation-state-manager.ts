import type {
  NcpCompletedEnvelope,
  NcpFailedEnvelope,
  NcpMessageAbortPayload,
  NcpMessageAcceptedPayload,
  NcpMessageSentPayload,
  NcpRequestEnvelope,
  NcpResponseEnvelope,
  NcpRunErrorPayload,
  NcpRunFinishedPayload,
  NcpRunMetadataPayload,
  NcpRunStartedPayload,
  NcpToolCallArgsDeltaPayload,
  NcpToolCallArgsPayload,
  NcpToolCallEndPayload,
  NcpToolCallResultPayload,
  NcpToolCallStartPayload,
  NcpReasoningDeltaPayload,
  NcpReasoningEndPayload,
  NcpReasoningStartPayload,
  NcpTextDeltaPayload,
  NcpTextEndPayload,
  NcpTextStartPayload,
} from "../../types/events.js";
import type { NcpError } from "../../types/errors.js";
import type { NcpConversationStateManager } from "../conversation-state.js";

/**
 * Agent-scenario state manager: extends the generic conversation state manager
 * with explicit handle methods for each NCP event type that affects agent conversation state.
 *
 * Implementations may route dispatch(event) to the corresponding handleXxx(payload)
 * and use these handlers to update messages, streamingMessage, and error.
 */
export interface NcpAgentConversationStateManager extends NcpConversationStateManager {
  handleMessageRequest(payload: NcpRequestEnvelope): void;
  /** Local peer sent a message (outbound); typically non-streaming. Add to messages. */
  handleMessageSent(payload: NcpMessageSentPayload): void;
  handleMessageAccepted(payload: NcpMessageAcceptedPayload): void;
  handleMessageIncoming(payload: NcpResponseEnvelope): void;
  handleMessageCompleted(payload: NcpCompletedEnvelope): void;
  handleMessageFailed(payload: NcpFailedEnvelope): void;
  handleMessageAbort(payload: NcpMessageAbortPayload): void;

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
  handleMessageToolCallResult(payload: NcpToolCallResultPayload): void;

  handleRunStarted(payload: NcpRunStartedPayload): void;
  handleRunFinished(payload: NcpRunFinishedPayload): void;
  handleRunError(payload: NcpRunErrorPayload): void;
  handleRunMetadata(payload: NcpRunMetadataPayload): void;

  handleEndpointError(payload: NcpError): void;
}
