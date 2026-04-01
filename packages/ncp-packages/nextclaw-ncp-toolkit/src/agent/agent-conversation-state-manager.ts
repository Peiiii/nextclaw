import {
  type NcpAgentConversationSnapshot,
  type NcpAgentConversationStateManager,
  type NcpAgentConversationHydrationParams,
  type NcpEndpointEvent,
  type NcpError,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpMessageRole,
  type NcpMessageSentPayload,
  type NcpMessageStatus,
  type NcpRunContext,
  type NcpRunErrorPayload,
  type NcpRunFinishedPayload,
  type NcpRunMetadataPayload,
  type NcpRunReadyMetadata,
  type NcpRunStartedPayload,
  type NcpReasoningDeltaPayload,
  type NcpReasoningEndPayload,
  type NcpReasoningStartPayload,
  type NcpTextDeltaPayload,
  type NcpTextEndPayload,
  type NcpTextStartPayload,
  type NcpToolCallArgsDeltaPayload,
  type NcpToolCallArgsPayload,
  type NcpToolCallEndPayload,
  type NcpToolCallResultPayload,
  type NcpToolCallStartPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { cloneConversationMessage, normalizeConversationMessage } from "./agent-conversation-message-normalizer.js";
import { buildRuntimeError, clearToolCallTrackingByMessageId, findToolInvocationPart, findToolNameByCallId, remapTrackedToolCallsToMessageId, shouldPromoteStreamingMessageId, upsertToolInvocationPart } from "./agent-conversation-state-manager.utils.js";

const DEFAULT_ASSISTANT_ROLE: NcpMessageRole = "assistant";

export class DefaultNcpAgentConversationStateManager implements NcpAgentConversationStateManager {
  private messages: NcpMessage[] = [];
  private streamingMessage: NcpMessage | null = null;
  private error: NcpError | null = null;
  private activeRun: NcpRunContext | null = null;
  private readonly listeners = new Set<(snapshot: NcpAgentConversationSnapshot) => void>();
  private readonly toolCallMessageIdByCallId = new Map<string, string>();
  private readonly toolCallArgsRawByCallId = new Map<string, string>();
  private lastSettledRunId: string | null = null;
  private snapshotCache: NcpAgentConversationSnapshot | null = null;
  private snapshotVersion = -1;
  private stateVersion = 0;

  getSnapshot = (): NcpAgentConversationSnapshot => {
    if (this.snapshotCache && this.snapshotVersion === this.stateVersion) {
      return this.snapshotCache;
    }
    const snapshot: NcpAgentConversationSnapshot = {
      messages: this.messages,
      streamingMessage: this.streamingMessage,
      error: this.error
        ? {
            ...this.error,
            details: this.error.details ? { ...this.error.details } : undefined,
          }
        : null,
      activeRun: this.activeRun ? { ...this.activeRun } : null,
    };
    this.snapshotCache = snapshot;
    this.snapshotVersion = this.stateVersion;
    return snapshot;
  };

  subscribe = (listener: (snapshot: NcpAgentConversationSnapshot) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  reset = (): void => {
    if (
      this.messages.length === 0 &&
      !this.streamingMessage &&
      !this.error &&
      !this.activeRun &&
      this.toolCallMessageIdByCallId.size === 0 &&
      this.toolCallArgsRawByCallId.size === 0
    ) {
      return;
    }
    this.messages = [];
    this.streamingMessage = null;
    this.error = null;
    this.activeRun = null;
    this.toolCallMessageIdByCallId.clear();
    this.toolCallArgsRawByCallId.clear();
    this.lastSettledRunId = null;
    this.stateVersion += 1;
    this.notifyListeners();
  };

  hydrate = (payload: NcpAgentConversationHydrationParams): void => {
    this.messages = payload.messages.map((message: NcpMessage) =>
      normalizeConversationMessage(message),
    );
    this.streamingMessage = null;
    this.error = null;
    this.activeRun = payload.activeRun
      ? {
          ...payload.activeRun,
          sessionId: payload.activeRun.sessionId ?? payload.sessionId,
          abortDisabledReason: payload.activeRun.abortDisabledReason ?? null,
        }
      : null;
    this.toolCallMessageIdByCallId.clear();
    this.toolCallArgsRawByCallId.clear();
    this.lastSettledRunId = null;
    this.stateVersion += 1;
    this.notifyListeners();
  };

  dispatch = (event: NcpEndpointEvent): Promise<void> => this.dispatchBatch([event]);

  dispatchBatch = async (events: readonly NcpEndpointEvent[]): Promise<void> => {
    if (!events.length) return;
    const versionBeforeDispatch = this.stateVersion;
    events.forEach(this.applyEvent);
    if (this.stateVersion !== versionBeforeDispatch) this.notifyListeners();
  };

  private applyEvent = (event: NcpEndpointEvent): void => {
    switch (event.type) {
      case NcpEventType.MessageSent:
        this.handleMessageSent(event.payload);
        break;
      case NcpEventType.MessageAbort:
        this.handleMessageAbort(event.payload);
        break;
      case NcpEventType.MessageTextStart:
        this.handleMessageTextStart(event.payload);
        break;
      case NcpEventType.MessageTextDelta:
        this.handleMessageTextDelta(event.payload);
        break;
      case NcpEventType.MessageTextEnd:
        this.handleMessageTextEnd(event.payload);
        break;
      case NcpEventType.MessageReasoningStart:
        this.handleMessageReasoningStart(event.payload);
        break;
      case NcpEventType.MessageReasoningDelta:
        this.handleMessageReasoningDelta(event.payload);
        break;
      case NcpEventType.MessageReasoningEnd:
        this.handleMessageReasoningEnd(event.payload);
        break;
      case NcpEventType.MessageToolCallStart:
        this.handleMessageToolCallStart(event.payload);
        break;
      case NcpEventType.MessageToolCallArgs:
        this.handleMessageToolCallArgs(event.payload);
        break;
      case NcpEventType.MessageToolCallArgsDelta:
        this.handleMessageToolCallArgsDelta(event.payload);
        break;
      case NcpEventType.MessageToolCallEnd:
        this.handleMessageToolCallEnd(event.payload);
        break;
      case NcpEventType.MessageToolCallResult:
        this.handleMessageToolCallResult(event.payload);
        break;
      case NcpEventType.RunStarted:
        this.handleRunStarted(event.payload);
        break;
      case NcpEventType.RunFinished:
        this.handleRunFinished(event.payload);
        break;
      case NcpEventType.RunError:
        this.handleRunError(event.payload);
        break;
      case NcpEventType.RunMetadata:
        this.handleRunMetadata(event.payload);
        break;
      case NcpEventType.EndpointError:
        this.handleEndpointError(event.payload);
        break;
      default:
        break;
    }
  };

  handleMessageSent = (payload: NcpMessageSentPayload): void => {
    this.upsertMessage(payload.message);
    this.setError(null);
  };

  handleMessageAbort = (payload: NcpMessageAbortPayload): void => {
    const targetMessageId = payload.messageId?.trim();
    this.clearActiveRun();
    this.setError(null);

    if (
      this.streamingMessage &&
      (!targetMessageId || this.streamingMessage.id === targetMessageId)
    ) {
      const streamingMessageId = this.streamingMessage.id;
      this.upsertMessage({
        ...this.streamingMessage,
        status: "final",
      });
      this.replaceStreamingMessage(null);
      if (targetMessageId) {
        clearToolCallTrackingByMessageId(
          this.toolCallMessageIdByCallId,
          this.toolCallArgsRawByCallId,
          targetMessageId,
        );
      } else {
        clearToolCallTrackingByMessageId(
          this.toolCallMessageIdByCallId,
          this.toolCallArgsRawByCallId,
          streamingMessageId,
        );
      }
    }
  };

  handleMessageTextStart = (payload: NcpTextStartPayload): void => {
    this.ensureStreamingMessage(
      payload.sessionId,
      payload.messageId,
      "streaming",
    );
    this.setError(null);
  };

  handleMessageTextDelta = (payload: NcpTextDeltaPayload): void => {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(
      payload.sessionId,
      payload.messageId,
      "streaming",
    );
    const nextParts = [...targetMessage.parts];
    const lastPart = nextParts[nextParts.length - 1];
    if (lastPart?.type === "text") {
      nextParts[nextParts.length - 1] = {
        type: "text",
        text: `${lastPart.text}${payload.delta}`,
      };
    } else {
      nextParts.push({ type: "text", text: payload.delta });
    }

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  };

  handleMessageTextEnd = (payload: NcpTextEndPayload): void => {
    if (this.streamingMessage?.id !== payload.messageId) {
      return;
    }
    if (this.streamingMessage.status !== "streaming") {
      return;
    }
    this.replaceStreamingMessage({
      ...this.streamingMessage,
      status: "pending",
    });
  };

  handleMessageReasoningStart = (payload: NcpReasoningStartPayload): void => {
    this.ensureStreamingMessage(
      payload.sessionId,
      payload.messageId,
      "streaming",
    );
  };

  handleMessageReasoningDelta = (payload: NcpReasoningDeltaPayload): void => {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(
      payload.sessionId,
      payload.messageId,
      "streaming",
    );
    const nextParts = [...targetMessage.parts];
    const lastPart = nextParts[nextParts.length - 1];

    if (lastPart?.type === "reasoning") {
      nextParts[nextParts.length - 1] = {
        type: "reasoning",
        text: `${lastPart.text}${payload.delta}`,
      };
    } else {
      nextParts.push({ type: "reasoning", text: payload.delta });
    }

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  };

  handleMessageReasoningEnd = (payload: NcpReasoningEndPayload): void => {
    if (this.streamingMessage?.id !== payload.messageId) {
      return;
    }
    // End is an event boundary; no snapshot mutation required.
  };

  handleMessageToolCallStart = (payload: NcpToolCallStartPayload): void => {
    const targetMessage = this.resolveToolCallTargetMessage(
      payload.sessionId,
      payload.toolCallId,
      payload.messageId,
    );
    this.toolCallArgsRawByCallId.set(payload.toolCallId, "");

    const nextParts = upsertToolInvocationPart(targetMessage.parts, {
      type: "tool-invocation",
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      state: "partial-call",
      args: "",
    });

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
    this.setError(null);
  };

  handleMessageToolCallArgs = (payload: NcpToolCallArgsPayload): void => {
    this.toolCallArgsRawByCallId.set(payload.toolCallId, payload.args);
    this.applyToolCallArgs(payload.sessionId, payload.toolCallId, payload.args);
  };

  handleMessageToolCallArgsDelta = (payload: NcpToolCallArgsDeltaPayload): void => {
    const currentArgs =
      this.toolCallArgsRawByCallId.get(payload.toolCallId) ?? "";
    const nextArgs = `${currentArgs}${payload.delta}`;
    this.toolCallArgsRawByCallId.set(payload.toolCallId, nextArgs);
    this.applyToolCallArgs(
      payload.sessionId,
      payload.toolCallId,
      nextArgs,
      payload.messageId,
    );
  };

  handleMessageToolCallEnd = (payload: NcpToolCallEndPayload): void => {
    const targetMessage = this.resolveToolCallTargetMessage(
      payload.sessionId,
      payload.toolCallId,
    );
    const args = this.toolCallArgsRawByCallId.get(payload.toolCallId) ?? "";
    const nextParts = upsertToolInvocationPart(targetMessage.parts, {
      type: "tool-invocation",
      toolCallId: payload.toolCallId,
      toolName:
        findToolNameByCallId(targetMessage.parts, payload.toolCallId) ??
        "unknown",
      state: "call",
      args,
    });

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  };

  handleMessageToolCallResult = (payload: NcpToolCallResultPayload): void => {
    const updated = this.updateMessageContainingToolCall(
      payload.toolCallId,
      (targetMessage, existingPart) => {
        const mergedPart = {
          type: "tool-invocation" as const,
          toolCallId: payload.toolCallId,
          toolName: existingPart.toolName,
          state: "result" as const,
          args: existingPart.args,
          result: payload.content,
        };
        return upsertToolInvocationPart(targetMessage.parts, mergedPart);
      },
    );

    if (!updated) {
      const fallbackMessage = this.resolveToolCallTargetMessage(
        payload.sessionId,
        payload.toolCallId,
      );
      const nextParts = upsertToolInvocationPart(fallbackMessage.parts, {
        type: "tool-invocation",
        toolCallId: payload.toolCallId,
        toolName: "unknown",
        state: "result",
        result: payload.content,
      });
      this.replaceStreamingMessage({
        ...fallbackMessage,
        parts: nextParts,
        status: "streaming",
      });
    }
  };

  handleRunStarted = (payload: NcpRunStartedPayload): void => {
    if (this.isSettledRunId(payload.runId)) return;
    this.setError(null);
    this.activeRun = { runId: payload.runId ?? null, sessionId: payload.sessionId };
    this.stateVersion += 1;
  };

  handleRunFinished = (payload: NcpRunFinishedPayload): void => {
    this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
    this.settleStreamingMessage("final");
    this.setError(null);
    this.clearActiveRun();
  };

  handleRunError = (payload: NcpRunErrorPayload): void => {
    this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
    this.settleStreamingMessage("error");
    this.setError(buildRuntimeError(payload));
    this.clearActiveRun();
  };

  handleRunMetadata = (payload: NcpRunMetadataPayload): void => {
    const m = payload.metadata as Record<string, unknown>;
    if (m?.kind === "ready") {
      const ready = m as NcpRunReadyMetadata;
      if (this.isSettledRunId(ready.runId)) return;
      this.activeRun = {
        runId: ready.runId ?? this.activeRun?.runId ?? null,
        sessionId: ready.sessionId ?? this.activeRun?.sessionId,
        abortDisabledReason: ready.supportsAbort === false ? (ready.abortDisabledReason ?? "Unsupported") : null,
      };
      this.stateVersion += 1;
    } else if (m?.kind === "final") {
      this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
      this.clearActiveRun();
    }
  };

  handleEndpointError = (payload: NcpError): void => {
    if (payload.code === "abort-error") {
      this.handleMessageAbort({
        sessionId: this.activeRun?.sessionId ?? this.streamingMessage?.sessionId ?? "",
        ...(this.streamingMessage?.id ? { messageId: this.streamingMessage.id } : {}),
      });
      return;
    }
    this.settleStreamingMessage("error");
    this.clearActiveRun();
    this.setError(payload);
  };

  private applyToolCallArgs = (
    sessionId: string,
    toolCallId: string,
    args: string,
    messageId?: string,
  ): void => {
    const targetMessage = this.resolveToolCallTargetMessage(
      sessionId,
      toolCallId,
      messageId,
    );
    const toolName =
      findToolNameByCallId(targetMessage.parts, toolCallId) ?? "unknown";
    const nextParts = upsertToolInvocationPart(targetMessage.parts, {
      type: "tool-invocation",
      toolCallId,
      toolName,
      state: "partial-call",
      args,
    });

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  };

  private ensureStreamingMessage = (
    sessionId: string,
    messageId: string,
    status: NcpMessageStatus,
  ): NcpMessage => {
    if (this.streamingMessage?.id === messageId) {
      if (this.streamingMessage.status === status) {
        return this.streamingMessage;
      }
      const nextStreamingMessage = {
        ...this.streamingMessage,
        status,
      };
      this.replaceStreamingMessage(nextStreamingMessage);
      return nextStreamingMessage;
    }

    const messageIndex = this.messages.findIndex(
      (message) => message.id === messageId,
    );
    if (messageIndex >= 0) {
      const existingMessage = cloneConversationMessage(
        this.messages[messageIndex]!,
      );
      const nextMessages = [...this.messages];
      nextMessages.splice(messageIndex, 1);
      this.messages = nextMessages;
      this.stateVersion += 1;
      const nextStreamingMessage = {
        ...existingMessage,
        sessionId,
        status,
      };
      this.replaceStreamingMessage(nextStreamingMessage);
      return nextStreamingMessage;
    }

    const existingStreamingMessage = this.streamingMessage;
    if (
      existingStreamingMessage &&
      existingStreamingMessage.id !== messageId &&
      existingStreamingMessage.sessionId === sessionId &&
      shouldPromoteStreamingMessageId(existingStreamingMessage, messageId)
    ) {
      const nextStreamingMessage: NcpMessage = {
        ...existingStreamingMessage,
        id: messageId,
        sessionId,
        status,
      };
      remapTrackedToolCallsToMessageId(
        this.toolCallMessageIdByCallId,
        existingStreamingMessage.id,
        messageId,
      );
      this.replaceStreamingMessage(nextStreamingMessage);
      return nextStreamingMessage;
    }

    const nextStreamingMessage: NcpMessage = {
      id: messageId,
      sessionId,
      role: DEFAULT_ASSISTANT_ROLE,
      status,
      parts: [],
      timestamp: new Date().toISOString(),
    };
    this.replaceStreamingMessage(nextStreamingMessage);
    return nextStreamingMessage;
  };

  private resolveToolCallTargetMessage = (
    sessionId: string,
    toolCallId: string,
    messageId?: string,
  ): NcpMessage => {
    const preferredMessageId =
      messageId?.trim() ||
      this.toolCallMessageIdByCallId.get(toolCallId) ||
      this.streamingMessage?.id ||
      `tool-${toolCallId}`;

    this.toolCallMessageIdByCallId.set(toolCallId, preferredMessageId);
    return this.ensureStreamingMessage(
      sessionId,
      preferredMessageId,
      "streaming",
    );
  };

  private updateMessageContainingToolCall = (
    toolCallId: string,
    updater: (
      targetMessage: NcpMessage,
      existingPart: Extract<
        NcpMessage["parts"][number],
        { type: "tool-invocation" }
      >,
    ) => NcpMessage["parts"],
  ): boolean => {
    if (this.streamingMessage) {
      const part = findToolInvocationPart(
        this.streamingMessage.parts,
        toolCallId,
      );
      if (part) {
        const nextParts = updater(this.streamingMessage, part);
        this.replaceStreamingMessage({
          ...this.streamingMessage,
          parts: nextParts,
        });
        return true;
      }
    }

    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const candidateMessage = this.messages[index];
      const part = findToolInvocationPart(candidateMessage.parts, toolCallId);
      if (!part) {
        continue;
      }
      const nextMessages = [...this.messages];
      nextMessages[index] = {
        ...candidateMessage,
        parts: updater(candidateMessage, part),
      };
      this.messages = nextMessages;
      this.stateVersion += 1;
      return true;
    }

    return false;
  };

  private upsertMessage = (message: NcpMessage): void => {
    const normalizedMessage = normalizeConversationMessage(message);
    const messageIndex = this.messages.findIndex(
      (item) => item.id === normalizedMessage.id,
    );
    if (messageIndex < 0) {
      this.messages = [...this.messages, normalizedMessage];
      this.stateVersion += 1;
      return;
    }

    const nextMessages = [...this.messages];
    nextMessages[messageIndex] = normalizedMessage;
    this.messages = nextMessages;
    this.stateVersion += 1;
  };

  private replaceStreamingMessage = (
    nextStreamingMessage: NcpMessage | null,
  ): void => {
    if (!nextStreamingMessage && !this.streamingMessage) {
      return;
    }
    this.streamingMessage = nextStreamingMessage
      ? normalizeConversationMessage(nextStreamingMessage)
      : null;
    this.stateVersion += 1;
  };

  private setError = (nextError: NcpError | null): void => {
    const hasSameError =
      this.error?.code === nextError?.code &&
      this.error?.message === nextError?.message &&
      this.error?.details === nextError?.details &&
      this.error?.cause === nextError?.cause;
    if (hasSameError) {
      return;
    }

    this.error = nextError
      ? {
          ...nextError,
          details: nextError.details ? { ...nextError.details } : undefined,
        }
      : null;
    this.stateVersion += 1;
  };

  private clearActiveRun = (): void => {
    if (!this.activeRun) return;
    this.activeRun = null;
    this.stateVersion += 1;
  };

  private isSettledRunId = (runId: string | null | undefined): boolean => {
    return Boolean(runId?.trim()) && runId === this.lastSettledRunId;
  };

  private markRunAsSettled = (runId: string | null | undefined): void => {
    this.lastSettledRunId = runId?.trim() || null;
  };

  private settleStreamingMessage = (
    status: Extract<NcpMessageStatus, "final" | "error">,
  ): void => {
    if (!this.streamingMessage) {
      return;
    }
    const settledMessage: NcpMessage = {
      ...this.streamingMessage,
      status,
    };
    this.upsertMessage(settledMessage);
    this.replaceStreamingMessage(null);
    clearToolCallTrackingByMessageId(
      this.toolCallMessageIdByCallId,
      this.toolCallArgsRawByCallId,
      settledMessage.id,
    );
  };

  private notifyListeners = (): void => {
    const snapshot: NcpAgentConversationSnapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  };
}
