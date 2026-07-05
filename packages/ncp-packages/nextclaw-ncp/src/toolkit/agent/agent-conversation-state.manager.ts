import type {
  NcpContextWindowUpdatedPayload,
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
  NcpReasoningDeltaPayload,
  NcpReasoningEndPayload,
  NcpReasoningStartPayload,
  NcpTextDeltaPayload,
  NcpTextEndPayload,
  NcpTextStartPayload,
} from "../../types/events.types.js";
import type { NcpError } from "../../types/errors.js";
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
  hydrate(payload: NcpAgentConversationHydrationParams): void;
  /** Local peer sent a message (outbound); typically non-streaming. Add to messages. */
  handleMessageSent(payload: NcpMessageSentPayload): void;
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
  handleContextWindowUpdated(payload: NcpContextWindowUpdatedPayload): void;

  handleEndpointError(payload: NcpError): void;
}
