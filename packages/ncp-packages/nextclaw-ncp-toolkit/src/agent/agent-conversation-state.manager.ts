import {
  type NcpAgentConversationSnapshot,
  type NcpAgentConversationStateManager,
  type NcpAgentConversationHydrationParams,
  type NcpContextWindowUpdatedPayload,
  type NcpEndpointEvent,
  type NcpError,
  type NcpFailedEnvelope,
  type NcpCompletedEnvelope,
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
  type NcpToolExecutionStartedPayload
} from "@nextclaw/ncp";
import { cloneConversationMessage, normalizeConversationMessage } from "./agent-conversation-message-normalizer.js";
import { AgentRunExecutionMetadataManager } from "./agent-run-execution-metadata.manager.js";
import { AgentConversationToolCallManager } from "./agent-conversation-tool-call.manager.js";
import {
  buildRuntimeError,
  cancelInFlightToolInvocations,
  findToolInvocationPart,
  prependConversationHistory,
  rebaseStreamingMessageIndex,
  readMessageLifecycleFromRunPayload,
  routeAgentConversationEvent,
  settleMessageWithLifecycle,
  shouldPromoteStreamingMessageId,
  upsertMessageByEventOrder
} from "./agent-conversation-state-manager.utils.js";

const DEFAULT_ASSISTANT_ROLE: NcpMessageRole = "assistant";

export class DefaultNcpAgentConversationStateManager implements NcpAgentConversationStateManager {
  private messages: NcpMessage[] = [];
  private streamingMessage: NcpMessage | null = null;
  private streamingMessageIndex: number | null = null;
  private error: NcpError | null = null;
  private activeRun: NcpRunContext | null = null;
  private contextWindow: Record<string, unknown> | null = null;
  private readonly listeners = new Set<(snapshot: NcpAgentConversationSnapshot) => void>();
  private readonly runExecution = new AgentRunExecutionMetadataManager();
  private readonly toolCalls: AgentConversationToolCallManager;
  private lastSettledRunId: string | null = null;
  private snapshotCache: NcpAgentConversationSnapshot | null = null;
  private snapshotVersion = -1;
  private stateVersion = 0;

  constructor() {
    this.toolCalls = new AgentConversationToolCallManager({
      ensureStreamingMessage: this.ensureStreamingMessage,
      readStreamingMessageId: () => this.streamingMessage?.id ?? null,
      replaceStreamingMessage: this.replaceStreamingMessage,
      updateMessageContainingToolCall: this.updateMessageContainingToolCall
    });
  }

  getSnapshot = (): NcpAgentConversationSnapshot => {
    if (this.snapshotCache && this.snapshotVersion === this.stateVersion) {
      return this.snapshotCache;
    }
    const snapshot: NcpAgentConversationSnapshot = {
      messages: this.messages,
      streamingMessage: this.streamingMessage,
      streamingMessageIndex: this.streamingMessageIndex,
      error: this.error
        ? {
            ...this.error,
            details: this.error.details ? { ...this.error.details } : undefined
          }
        : null,
      activeRun: this.activeRun ? { ...this.activeRun } : null,
      contextWindow: this.contextWindow ? { ...this.contextWindow } : null
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
      this.runExecution.isEmpty &&
      !this.contextWindow &&
      this.toolCalls.isEmpty()
    ) {
      return;
    }
    this.messages = [];
    this.streamingMessage = null;
    this.streamingMessageIndex = null;
    this.error = null;
    this.activeRun = null;
    this.runExecution.clear();
    this.contextWindow = null;
    this.toolCalls.clear();
    this.lastSettledRunId = null;
    this.stateVersion += 1;
    this.notifyListeners();
  };

  clearError = (): void => {
    const versionBeforeClear = this.stateVersion;
    this.setError(null);
    if (this.stateVersion !== versionBeforeClear) {
      this.notifyListeners();
    }
  };

  hydrate = (payload: NcpAgentConversationHydrationParams): void => {
    this.messages = [...new Map(payload.messages.map((message) => [message.id, normalizeConversationMessage(message)])).values()];
    this.streamingMessage = null;
    this.streamingMessageIndex = null;
    this.error = null;
    this.contextWindow = payload.contextWindow ? { ...payload.contextWindow } : null;
    this.activeRun = payload.activeRun
      ? {
          ...payload.activeRun,
          sessionId: payload.activeRun.sessionId ?? payload.sessionId,
          abortDisabledReason: payload.activeRun.abortDisabledReason ?? null
        }
      : null;
    this.runExecution.clear();
    this.toolCalls.hydrate(this.messages);
    this.lastSettledRunId = null;
    this.stateVersion += 1;
    this.notifyListeners();
  };

  prependHistory = (messages: ReadonlyArray<NcpMessage>): void => {
    const currentMessages = this.messages;
    const nextMessages = prependConversationHistory(this.messages, this.streamingMessage, messages);
    if (nextMessages === currentMessages) {
      return;
    }
    this.messages = nextMessages;
    if (this.streamingMessageIndex !== null) this.streamingMessageIndex = rebaseStreamingMessageIndex(currentMessages, nextMessages, this.streamingMessageIndex);
    this.toolCalls.hydrate(this.messages);
    this.stateVersion += 1;
    this.notifyListeners();
  };

  dispatch = (event: NcpEndpointEvent): Promise<void> => this.dispatchBatch([event]);

  dispatchBatch = async (events: readonly NcpEndpointEvent[]): Promise<void> => {
    if (!events.length) return;
    const versionBeforeDispatch = this.stateVersion;
    events.forEach((event) => routeAgentConversationEvent(this, event));
    if (this.stateVersion !== versionBeforeDispatch) this.notifyListeners();
  };

  handleMessageSent = (payload: NcpMessageSentPayload): void => {
    this.upsertMessage(payload.message);
    this.setError(null);
  };

  handleMessageCompleted = (payload: NcpCompletedEnvelope): void => {
    const runId = this.activeRun?.runId;
    const message = this.runExecution.attach(
      normalizeConversationMessage({
        ...payload.message,
        status: "final"
      }),
      this.runExecution.take(runId),
    );
    if (this.streamingMessage?.id === message.id) {
      this.upsertMessage(message);
      this.toolCalls.clearByMessageId(message.id);
      return;
    }
    this.upsertMessage(message);
  };

  handleMessageAbort = (payload: NcpMessageAbortPayload, occurredAt?: string): void => {
    const targetMessageId = payload.messageId?.trim();
    const runId = payload.runId ?? this.activeRun?.runId;
    const metadata = this.runExecution.take(runId);
    this.clearActiveRun();
    this.setError(null);

    if (this.streamingMessage && (!targetMessageId || this.streamingMessage.id === targetMessageId)) {
      const streamingMessageId = this.streamingMessage.id;
      const { parts: nextParts, toolCallIds } = cancelInFlightToolInvocations(
        this.streamingMessage.parts,
        occurredAt,
      );
      this.upsertMessage(
        this.runExecution.attach(
          {
            ...this.streamingMessage,
            status: "final",
            parts: nextParts
          },
          metadata,
        )
      );
      this.replaceStreamingMessage(null);
      this.toolCalls.clearByMessageId(targetMessageId || streamingMessageId);
      this.toolCalls.markAborted(toolCallIds);
    }
  };

  handleMessageFailed = (payload: NcpFailedEnvelope, occurredAt?: string): void => {
    if (this.streamingMessage && (!payload.messageId || this.streamingMessage.id === payload.messageId)) {
      this.settleStreamingMessage(
        "error",
        occurredAt ? { endedAt: occurredAt } : undefined,
        this.activeRun?.runId,
      );
    }
    this.clearActiveRun();
    this.setError(payload.error);
  };

  handleMessageTextStart = (payload: NcpTextStartPayload): void => {
    const wasActiveStreamingMessage = this.streamingMessage?.id === payload.messageId;
    const targetMessage = this.ensureStreamingMessage(payload.sessionId, payload.messageId, "streaming");
    const lastPart = targetMessage.parts[targetMessage.parts.length - 1];
    if (wasActiveStreamingMessage && lastPart?.type === "text" && lastPart.text.length > 0) {
      this.replaceStreamingMessage({
        ...targetMessage,
        parts: [...targetMessage.parts, { type: "text", text: "" }],
        status: "streaming"
      });
    }
    this.setError(null);
  };

  handleMessageTextDelta = (payload: NcpTextDeltaPayload): void => {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(payload.sessionId, payload.messageId, "streaming");
    const nextParts = [...targetMessage.parts];
    const lastPart = nextParts[nextParts.length - 1];
    if (lastPart?.type === "text") {
      nextParts[nextParts.length - 1] = {
        type: "text",
        text: `${lastPart.text}${payload.delta}`
      };
    } else {
      nextParts.push({ type: "text", text: payload.delta });
    }

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming"
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
      status: "pending"
    });
  };

  handleMessageReasoningStart = (payload: NcpReasoningStartPayload): void => {
    this.ensureStreamingMessage(payload.sessionId, payload.messageId, "streaming");
  };

  handleMessageReasoningDelta = (payload: NcpReasoningDeltaPayload): void => {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(payload.sessionId, payload.messageId, "streaming");
    const nextParts = [...targetMessage.parts];
    const lastPart = nextParts[nextParts.length - 1];

    if (lastPart?.type === "reasoning") {
      nextParts[nextParts.length - 1] = {
        type: "reasoning",
        text: `${lastPart.text}${payload.delta}`
      };
    } else {
      nextParts.push({ type: "reasoning", text: payload.delta });
    }

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming"
    });
  };

  handleMessageReasoningEnd = (payload: NcpReasoningEndPayload): void => {
    if (this.streamingMessage?.id !== payload.messageId) {
      return;
    }
    // End is an event boundary; no snapshot mutation required.
  };

  handleMessageToolCallStart = (payload: NcpToolCallStartPayload): void => {
    this.toolCalls.handleToolCallStart(payload);
    this.setError(null);
  };

  handleMessageToolCallArgs = (payload: NcpToolCallArgsPayload): void => {
    this.toolCalls.handleToolCallArgs(payload);
  };

  handleMessageToolCallArgsDelta = (payload: NcpToolCallArgsDeltaPayload): void => {
    this.toolCalls.handleToolCallArgsDelta(payload);
  };

  handleMessageToolCallEnd = (payload: NcpToolCallEndPayload): void => {
    this.toolCalls.handleToolCallEnd(payload);
  };

  handleMessageToolExecutionStarted = (
    payload: NcpToolExecutionStartedPayload,
    occurredAt?: string,
  ): void => {
    this.toolCalls.handleToolExecutionStarted(payload, occurredAt);
  };

  handleMessageToolCallResult = (payload: NcpToolCallResultPayload, occurredAt?: string): void => {
    this.toolCalls.handleToolCallResult(payload, occurredAt);
  };

  handleRunStarted = (payload: NcpRunStartedPayload, occurredAt?: string): void => {
    if (this.isSettledRunId(payload.runId) || (payload.runId && this.activeRun?.runId === payload.runId)) return;
    if (this.streamingMessage && this.activeRun?.runId !== payload.runId) {
      this.handleMessageAbort(
        { sessionId: this.streamingMessage.sessionId, messageId: this.streamingMessage.id },
        occurredAt,
      );
    }
    this.runExecution.beginRun(payload.runId);
    this.setError(null);
    this.activeRun = {
      runId: payload.runId ?? null,
      sessionId: payload.sessionId
    };
    this.stateVersion += 1;
  };

  handleRunFinished = (payload: NcpRunFinishedPayload, occurredAt?: string): void => {
    this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
    this.settleStreamingMessage(
      "final",
      readMessageLifecycleFromRunPayload({
        ...payload,
        endedAt: payload.endedAt ?? occurredAt,
      }),
      payload.runId ?? this.activeRun?.runId,
    );
    this.setError(null);
    this.clearActiveRun();
  };

  handleRunError = (payload: NcpRunErrorPayload, occurredAt?: string): void => {
    this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
    this.settleStreamingMessage(
      "error",
      readMessageLifecycleFromRunPayload({
        ...payload,
        endedAt: payload.endedAt ?? occurredAt,
      }),
      payload.runId ?? this.activeRun?.runId,
    );
    this.setError(buildRuntimeError(payload));
    this.clearActiveRun();
  };

  handleRunMetadata = (payload: NcpRunMetadataPayload): void => {
    this.runExecution.observe(payload);
    const m = payload.metadata as Record<string, unknown>;
    if (m?.kind === "ready") {
      const ready = m as NcpRunReadyMetadata;
      if (this.isSettledRunId(ready.runId)) return;
      this.activeRun = {
        runId: ready.runId ?? this.activeRun?.runId ?? null,
        sessionId: ready.sessionId ?? this.activeRun?.sessionId,
        abortDisabledReason: ready.supportsAbort === false ? (ready.abortDisabledReason ?? "Unsupported") : null
      };
      this.stateVersion += 1;
    } else if (m?.kind === "final") {
      this.markRunAsSettled(payload.runId ?? this.activeRun?.runId ?? null);
      this.clearActiveRun();
    }
  };

  handleContextWindowUpdated = (payload: NcpContextWindowUpdatedPayload): void => {
    this.contextWindow = { ...payload.contextWindow };
    this.stateVersion += 1;
  };

  handleEndpointError = (payload: NcpError, occurredAt?: string): void => {
    if (payload.code === "abort-error") {
      this.handleMessageAbort({
        sessionId: this.activeRun?.sessionId ?? this.streamingMessage?.sessionId ?? "",
        ...(this.streamingMessage?.id ? { messageId: this.streamingMessage.id } : {})
      }, occurredAt);
      return;
    }
    this.settleStreamingMessage("error", occurredAt ? { endedAt: occurredAt } : undefined);
    this.clearActiveRun();
    this.setError(payload);
  };

  private ensureStreamingMessage = (sessionId: string, messageId: string, status: NcpMessageStatus): NcpMessage => {
    if (this.streamingMessage?.id === messageId) {
      if (this.streamingMessage.status === status) {
        return this.streamingMessage;
      }
      const nextStreamingMessage = {
        ...this.streamingMessage,
        status
      };
      this.replaceStreamingMessage(nextStreamingMessage);
      return nextStreamingMessage;
    }

    const messageIndex = this.messages.findIndex((message) => message.id === messageId);
    if (messageIndex >= 0) {
      const existingMessage = cloneConversationMessage(this.messages[messageIndex]!);
      const nextMessages = [...this.messages];
      nextMessages.splice(messageIndex, 1);
      this.messages = nextMessages;
      this.streamingMessageIndex = messageIndex;
      this.stateVersion += 1;
      const nextStreamingMessage = {
        ...existingMessage,
        sessionId,
        status
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
        status
      };
      this.toolCalls.remapMessageId(existingStreamingMessage.id, messageId);
      this.replaceStreamingMessage(nextStreamingMessage);
      return nextStreamingMessage;
    }

    const nextStreamingMessage: NcpMessage = {
      id: messageId,
      sessionId,
      role: DEFAULT_ASSISTANT_ROLE,
      status,
      parts: [],
      timestamp: new Date().toISOString()
    };
    this.streamingMessageIndex = this.messages.length;
    this.replaceStreamingMessage(nextStreamingMessage);
    return nextStreamingMessage;
  };

  private updateMessageContainingToolCall = (
    toolCallId: string,
    updater: (targetMessage: NcpMessage, existingPart: Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>) => NcpMessage["parts"]
  ): boolean => {
    if (this.streamingMessage) {
      const part = findToolInvocationPart(this.streamingMessage.parts, toolCallId);
      if (part) {
        const nextParts = updater(this.streamingMessage, part);
        this.replaceStreamingMessage({
          ...this.streamingMessage,
          parts: nextParts
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
        parts: updater(candidateMessage, part)
      };
      this.messages = nextMessages;
      this.stateVersion += 1;
      return true;
    }

    return false;
  };

  private upsertMessage = (message: NcpMessage): void => {
    const nextState = upsertMessageByEventOrder(this.messages, this.streamingMessage, this.streamingMessageIndex, message);
    this.messages = nextState.messages;
    this.streamingMessage = nextState.streamingMessage;
    this.streamingMessageIndex = nextState.streamingMessageIndex;
    this.stateVersion += 1;
  };

  private replaceStreamingMessage = (nextStreamingMessage: NcpMessage | null): void => {
    if (!nextStreamingMessage && !this.streamingMessage && this.streamingMessageIndex === null) {
      return;
    }
    this.streamingMessageIndex = nextStreamingMessage ? this.streamingMessageIndex ?? this.messages.length : null;
    this.streamingMessage = nextStreamingMessage ? normalizeConversationMessage(nextStreamingMessage) : null;
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
          details: nextError.details ? { ...nextError.details } : undefined
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

  private settleStreamingMessage = (status: Extract<NcpMessageStatus, "final" | "error">, lifecycle?: NcpMessage["lifecycle"], runId?: string | null): void => {
    const metadata = this.runExecution.take(runId);
    if (!this.streamingMessage) return;
    const settledMessage = this.runExecution.attach(
      settleMessageWithLifecycle(this.streamingMessage, status, lifecycle),
      metadata,
    );
    this.upsertMessage(settledMessage);
    this.replaceStreamingMessage(null);
    this.toolCalls.clearByMessageId(settledMessage.id);
  };

  private notifyListeners = (): void => {
    const snapshot: NcpAgentConversationSnapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  };
}
