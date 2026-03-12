import type {
  NcpAgentConversationStateManager,
  NcpCompletedEnvelope,
  NcpConversationSnapshot,
  NcpEndpointEvent,
  NcpError,
  NcpFailedEnvelope,
  NcpMessage,
  NcpMessageAbortPayload,
  NcpMessageAcceptedPayload,
  NcpMessageRole,
  NcpMessageSentPayload,
  NcpMessageStatus,
  NcpRequestEnvelope,
  NcpResponseEnvelope,
  NcpRunErrorPayload,
  NcpRunFinishedPayload,
  NcpRunMetadataPayload,
  NcpRunStartedPayload,
  NcpReasoningDeltaPayload,
  NcpReasoningEndPayload,
  NcpReasoningStartPayload,
  NcpTextDeltaPayload,
  NcpTextEndPayload,
  NcpTextStartPayload,
  NcpToolCallArgsDeltaPayload,
  NcpToolCallArgsPayload,
  NcpToolCallEndPayload,
  NcpToolCallResultPayload,
  NcpToolCallStartPayload,
} from "@nextclaw/ncp";

const DEFAULT_ASSISTANT_ROLE: NcpMessageRole = "assistant";

const cloneMessage = (message: NcpMessage): NcpMessage => {
  return {
    ...message,
    parts: [...message.parts],
    metadata: message.metadata ? { ...message.metadata } : undefined,
  };
};

const buildRuntimeError = (payload: NcpRunErrorPayload): NcpError => {
  const message = payload.error?.trim();
  return {
    code: "runtime-error",
    message: message && message.length > 0 ? message : "Agent run failed.",
    details: {
      sessionKey: payload.sessionKey,
      messageId: payload.messageId,
      threadId: payload.threadId,
      runId: payload.runId,
    },
  };
};

export class DefaultNcpAgentConversationStateManager
  implements NcpAgentConversationStateManager
{
  private messages: NcpMessage[] = [];
  private streamingMessage: NcpMessage | null = null;
  private error: NcpError | null = null;
  private readonly listeners = new Set<(snapshot: NcpConversationSnapshot) => void>();

  private readonly toolCallMessageIdByCallId = new Map<string, string>();
  private readonly toolCallArgsRawByCallId = new Map<string, string>();
  private stateVersion = 0;

  getSnapshot(): NcpConversationSnapshot {
    return {
      messages: this.messages.map((message) => cloneMessage(message)),
      streamingMessage: this.streamingMessage ? cloneMessage(this.streamingMessage) : null,
      error: this.error ? { ...this.error, details: this.error.details ? { ...this.error.details } : undefined } : null,
    };
  }

  subscribe(listener: (snapshot: NcpConversationSnapshot) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispatch(event: NcpEndpointEvent): Promise<void> {
    const versionBeforeDispatch = this.stateVersion;
    switch (event.type) {
      case "message.request":
        this.handleMessageRequest(event.payload);
        break;
      case "message.resume-request":
        break;
      case "message.sent":
        this.handleMessageSent(event.payload);
        break;
      case "message.accepted":
        this.handleMessageAccepted(event.payload);
        break;
      case "message.incoming":
        this.handleMessageIncoming(event.payload);
        break;
      case "message.completed":
        this.handleMessageCompleted(event.payload);
        break;
      case "message.failed":
        this.handleMessageFailed(event.payload);
        break;
      case "message.abort":
        this.handleMessageAbort(event.payload);
        break;
      case "message.text-start":
        this.handleMessageTextStart(event.payload);
        break;
      case "message.text-delta":
        this.handleMessageTextDelta(event.payload);
        break;
      case "message.text-end":
        this.handleMessageTextEnd(event.payload);
        break;
      case "message.reasoning-start":
        this.handleMessageReasoningStart(event.payload);
        break;
      case "message.reasoning-delta":
        this.handleMessageReasoningDelta(event.payload);
        break;
      case "message.reasoning-end":
        this.handleMessageReasoningEnd(event.payload);
        break;
      case "message.tool-call-start":
        this.handleMessageToolCallStart(event.payload);
        break;
      case "message.tool-call-args":
        this.handleMessageToolCallArgs(event.payload);
        break;
      case "message.tool-call-args-delta":
        this.handleMessageToolCallArgsDelta(event.payload);
        break;
      case "message.tool-call-end":
        this.handleMessageToolCallEnd(event.payload);
        break;
      case "message.tool-call-result":
        this.handleMessageToolCallResult(event.payload);
        break;
      case "run.started":
        this.handleRunStarted(event.payload);
        break;
      case "run.finished":
        this.handleRunFinished(event.payload);
        break;
      case "run.error":
        this.handleRunError(event.payload);
        break;
      case "run.metadata":
        this.handleRunMetadata(event.payload);
        break;
      case "endpoint.error":
        this.handleEndpointError(event.payload);
        break;
      case "endpoint.ready":
      case "typing.start":
      case "typing.end":
      case "presence.updated":
      case "message.read":
      case "message.delivered":
      case "message.recalled":
      case "message.reaction":
        break;
      default:
        break;
    }

    if (this.stateVersion !== versionBeforeDispatch) {
      const snapshot = this.getSnapshot();
      for (const listener of this.listeners) {
        listener(snapshot);
      }
    }
  }

  handleMessageRequest(payload: NcpRequestEnvelope): void {
    this.upsertMessage(payload.message);
    this.setError(null);
  }

  handleMessageSent(payload: NcpMessageSentPayload): void {
    this.upsertMessage(payload.message);
    this.setError(null);
  }

  handleMessageAccepted(_payload: NcpMessageAcceptedPayload): void {
    // Accepted acknowledges transport delivery and does not mutate conversation snapshot.
  }

  handleMessageIncoming(payload: NcpResponseEnvelope): void {
    const incomingMessage = cloneMessage(payload.message);
    if (incomingMessage.status === "streaming" || incomingMessage.status === "pending") {
      this.replaceStreamingMessage(incomingMessage);
      this.setError(null);
      return;
    }

    this.upsertMessage(incomingMessage);
    if (this.streamingMessage?.id === incomingMessage.id) {
      this.replaceStreamingMessage(null);
      this.clearToolCallTrackingByMessageId(incomingMessage.id);
    }
    this.setError(null);
  }

  handleMessageCompleted(payload: NcpCompletedEnvelope): void {
    const completedMessage: NcpMessage = {
      ...cloneMessage(payload.message),
      status: "final",
    };
    this.upsertMessage(completedMessage);
    if (this.streamingMessage?.id === completedMessage.id) {
      this.replaceStreamingMessage(null);
    }
    this.clearToolCallTrackingByMessageId(completedMessage.id);
    this.setError(null);
  }

  handleMessageFailed(payload: NcpFailedEnvelope): void {
    this.setError(payload.error);
    const targetMessageId = payload.messageId?.trim();
    if (!targetMessageId) {
      return;
    }

    if (this.streamingMessage?.id === targetMessageId) {
      this.upsertMessage({
        ...this.streamingMessage,
        status: "error",
      });
      this.replaceStreamingMessage(null);
      this.clearToolCallTrackingByMessageId(targetMessageId);
      return;
    }

    const messageIndex = this.messages.findIndex((message) => message.id === targetMessageId);
    if (messageIndex < 0) {
      return;
    }

    const nextMessages = [...this.messages];
    nextMessages[messageIndex] = {
      ...nextMessages[messageIndex],
      status: "error",
    };
    this.messages = nextMessages;
    this.stateVersion += 1;
  }

  handleMessageAbort(payload: NcpMessageAbortPayload): void {
    const targetMessageId = payload.messageId?.trim();
    this.setError({
      code: "abort-error",
      message: "Message aborted.",
      details: {
        messageId: targetMessageId,
        correlationId: payload.correlationId,
      },
    });

    if (this.streamingMessage && (!targetMessageId || this.streamingMessage.id === targetMessageId)) {
      this.upsertMessage({
        ...this.streamingMessage,
        status: "error",
      });
      this.replaceStreamingMessage(null);
      if (targetMessageId) {
        this.clearToolCallTrackingByMessageId(targetMessageId);
      }
    }
  }

  handleMessageTextStart(payload: NcpTextStartPayload): void {
    this.ensureStreamingMessage(payload.sessionKey, payload.messageId, "streaming");
    this.setError(null);
  }

  handleMessageTextDelta(payload: NcpTextDeltaPayload): void {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(payload.sessionKey, payload.messageId, "streaming");
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
  }

  handleMessageTextEnd(payload: NcpTextEndPayload): void {
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
  }

  handleMessageReasoningStart(payload: NcpReasoningStartPayload): void {
    this.ensureStreamingMessage(payload.sessionKey, payload.messageId, "streaming");
  }

  handleMessageReasoningDelta(payload: NcpReasoningDeltaPayload): void {
    if (!payload.delta) {
      return;
    }

    const targetMessage = this.ensureStreamingMessage(payload.sessionKey, payload.messageId, "streaming");
    const nextParts = [...targetMessage.parts];
    const reasoningPartIndex = this.findLastReasoningPartIndex(nextParts);

    if (reasoningPartIndex >= 0) {
      const existingPart = nextParts[reasoningPartIndex];
      if (existingPart?.type === "reasoning") {
        nextParts[reasoningPartIndex] = {
          type: "reasoning",
          text: `${existingPart.text}${payload.delta}`,
        };
      }
    } else {
      nextParts.push({ type: "reasoning", text: payload.delta });
    }

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  }

  handleMessageReasoningEnd(payload: NcpReasoningEndPayload): void {
    if (this.streamingMessage?.id !== payload.messageId) {
      return;
    }
    // End is an event boundary; no snapshot mutation required.
  }

  handleMessageToolCallStart(payload: NcpToolCallStartPayload): void {
    const targetMessage = this.resolveToolCallTargetMessage(
      payload.sessionKey,
      payload.toolCallId,
      payload.messageId,
    );
    this.toolCallArgsRawByCallId.set(payload.toolCallId, "");

    const nextParts = this.upsertToolInvocationPart(targetMessage.parts, {
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
  }

  handleMessageToolCallArgs(payload: NcpToolCallArgsPayload): void {
    this.toolCallArgsRawByCallId.set(payload.toolCallId, payload.args);
    this.applyToolCallArgs(payload.sessionKey, payload.toolCallId, payload.args);
  }

  handleMessageToolCallArgsDelta(payload: NcpToolCallArgsDeltaPayload): void {
    const currentArgs = this.toolCallArgsRawByCallId.get(payload.toolCallId) ?? "";
    const nextArgs = `${currentArgs}${payload.delta}`;
    this.toolCallArgsRawByCallId.set(payload.toolCallId, nextArgs);
    this.applyToolCallArgs(payload.sessionKey, payload.toolCallId, nextArgs, payload.messageId);
  }

  handleMessageToolCallEnd(payload: NcpToolCallEndPayload): void {
    const targetMessage = this.resolveToolCallTargetMessage(payload.sessionKey, payload.toolCallId);
    const args = this.toolCallArgsRawByCallId.get(payload.toolCallId) ?? "";
    const nextParts = this.upsertToolInvocationPart(targetMessage.parts, {
      type: "tool-invocation",
      toolCallId: payload.toolCallId,
      toolName: this.findToolNameByCallId(targetMessage.parts, payload.toolCallId) ?? "unknown",
      state: "call",
      args,
    });

    this.replaceStreamingMessage({
      ...targetMessage,
      parts: nextParts,
      status: "streaming",
    });
  }

  handleMessageToolCallResult(payload: NcpToolCallResultPayload): void {
    const updated = this.updateMessageContainingToolCall(payload.toolCallId, (targetMessage, existingPart) => {
      const mergedPart = {
        type: "tool-invocation" as const,
        toolCallId: payload.toolCallId,
        toolName: existingPart.toolName,
        state: "result" as const,
        args: existingPart.args,
        result: payload.content,
      };
      return this.upsertToolInvocationPart(targetMessage.parts, mergedPart);
    });

    if (!updated) {
      const fallbackMessage = this.resolveToolCallTargetMessage(payload.sessionKey, payload.toolCallId);
      const nextParts = this.upsertToolInvocationPart(fallbackMessage.parts, {
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
  }

  handleRunStarted(_payload: NcpRunStartedPayload): void {
    this.setError(null);
  }

  handleRunFinished(_payload: NcpRunFinishedPayload): void {
    // Run finished does not imply message completion in protocol-level state.
  }

  handleRunError(payload: NcpRunErrorPayload): void {
    this.setError(buildRuntimeError(payload));
  }

  handleRunMetadata(_payload: NcpRunMetadataPayload): void {
    // Metadata is intentionally ignored in conversation snapshot.
  }

  handleEndpointError(payload: NcpError): void {
    this.setError(payload);
  }

  private applyToolCallArgs(
    sessionKey: string,
    toolCallId: string,
    args: string,
    messageId?: string,
  ): void {
    const targetMessage = this.resolveToolCallTargetMessage(sessionKey, toolCallId, messageId);
    const toolName = this.findToolNameByCallId(targetMessage.parts, toolCallId) ?? "unknown";
    const nextParts = this.upsertToolInvocationPart(targetMessage.parts, {
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
  }

  private ensureStreamingMessage(
    sessionKey: string,
    messageId: string,
    status: NcpMessageStatus,
  ): NcpMessage {
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

    const nextStreamingMessage: NcpMessage = {
      id: messageId,
      sessionKey,
      role: DEFAULT_ASSISTANT_ROLE,
      status,
      parts: [],
      timestamp: new Date().toISOString(),
    };
    this.replaceStreamingMessage(nextStreamingMessage);
    return nextStreamingMessage;
  }

  private resolveToolCallTargetMessage(
    sessionKey: string,
    toolCallId: string,
    messageId?: string,
  ): NcpMessage {
    const preferredMessageId =
      messageId?.trim() ||
      this.toolCallMessageIdByCallId.get(toolCallId) ||
      this.streamingMessage?.id ||
      `tool-${toolCallId}`;

    this.toolCallMessageIdByCallId.set(toolCallId, preferredMessageId);
    return this.ensureStreamingMessage(sessionKey, preferredMessageId, "streaming");
  }

  private updateMessageContainingToolCall(
    toolCallId: string,
    updater: (
      targetMessage: NcpMessage,
      existingPart: Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>,
    ) => NcpMessage["parts"],
  ): boolean {
    if (this.streamingMessage) {
      const part = this.findToolInvocationPart(this.streamingMessage.parts, toolCallId);
      if (part) {
        const nextParts = updater(this.streamingMessage, part);
        this.replaceStreamingMessage({ ...this.streamingMessage, parts: nextParts });
        return true;
      }
    }

    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const candidateMessage = this.messages[index];
      const part = this.findToolInvocationPart(candidateMessage.parts, toolCallId);
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
  }

  private findToolInvocationPart(parts: NcpMessage["parts"], toolCallId: string) {
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const part = parts[index];
      if (part.type === "tool-invocation" && part.toolCallId === toolCallId) {
        return part;
      }
    }
    return null;
  }

  private findToolNameByCallId(parts: NcpMessage["parts"], toolCallId: string): string | null {
    const part = this.findToolInvocationPart(parts, toolCallId);
    return part?.toolName ?? null;
  }

  private upsertToolInvocationPart(
    parts: NcpMessage["parts"],
    toolPart: Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>,
  ): NcpMessage["parts"] {
    const nextParts = [...parts];
    for (let index = nextParts.length - 1; index >= 0; index -= 1) {
      const part = nextParts[index];
      if (part.type === "tool-invocation" && part.toolCallId === toolPart.toolCallId) {
        nextParts[index] = {
          ...part,
          ...toolPart,
        };
        return nextParts;
      }
    }
    nextParts.push(toolPart);
    return nextParts;
  }

  private findLastReasoningPartIndex(parts: NcpMessage["parts"]): number {
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (parts[index]?.type === "reasoning") {
        return index;
      }
    }
    return -1;
  }

  private upsertMessage(message: NcpMessage): void {
    const normalizedMessage = cloneMessage(message);
    const messageIndex = this.messages.findIndex((item) => item.id === normalizedMessage.id);
    if (messageIndex < 0) {
      this.messages = [...this.messages, normalizedMessage];
      this.stateVersion += 1;
      return;
    }

    const nextMessages = [...this.messages];
    nextMessages[messageIndex] = normalizedMessage;
    this.messages = nextMessages;
    this.stateVersion += 1;
  }

  private replaceStreamingMessage(nextStreamingMessage: NcpMessage | null): void {
    if (!nextStreamingMessage && !this.streamingMessage) {
      return;
    }
    this.streamingMessage = nextStreamingMessage ? cloneMessage(nextStreamingMessage) : null;
    this.stateVersion += 1;
  }

  private setError(nextError: NcpError | null): void {
    const hasSameError =
      this.error?.code === nextError?.code &&
      this.error?.message === nextError?.message &&
      this.error?.details === nextError?.details &&
      this.error?.cause === nextError?.cause;
    if (hasSameError) {
      return;
    }

    this.error = nextError
      ? { ...nextError, details: nextError.details ? { ...nextError.details } : undefined }
      : null;
    this.stateVersion += 1;
  }

  private clearToolCallTrackingByMessageId(messageId: string): void {
    for (const [toolCallId, trackedMessageId] of this.toolCallMessageIdByCallId) {
      if (trackedMessageId !== messageId) {
        continue;
      }
      this.toolCallMessageIdByCallId.delete(toolCallId);
      this.toolCallArgsRawByCallId.delete(toolCallId);
    }
  }
}
