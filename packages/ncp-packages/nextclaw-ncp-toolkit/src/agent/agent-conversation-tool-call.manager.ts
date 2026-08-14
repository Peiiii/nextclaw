import type {
  NcpMessage,
  NcpToolCallArgsDeltaPayload,
  NcpToolCallArgsPayload,
  NcpToolCallEndPayload,
  NcpToolCallResultPayload,
  NcpToolCallStartPayload,
  NcpToolExecutionStartedPayload,
} from "@nextclaw/ncp";
import {
  ABORTED_TOOL_CALL_SENTINEL,
  findToolNameByCallId,
  mergeToolExecutionTiming,
  normalizeToolExecutionTiming,
  normalizeToolExecutionTimestamp,
  upsertToolInvocationPart,
} from "./agent-conversation-state-manager.utils.js";

type ToolCallPart = Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>;

function hasTerminalExecution(part: ToolCallPart): boolean {
  return (
    part.state === "result" ||
    part.state === "cancelled" ||
    Boolean(part.execution?.endedAt) ||
    typeof part.execution?.durationMs === "number"
  );
}

type AgentConversationToolCallManagerPort = {
  ensureStreamingMessage: (
    sessionId: string,
    messageId: string,
    status: "streaming",
  ) => NcpMessage;
  replaceStreamingMessage: (message: NcpMessage) => void;
  updateMessageContainingToolCall: (
    toolCallId: string,
    updater: (
      targetMessage: NcpMessage,
      existingPart: ToolCallPart,
    ) => NcpMessage["parts"],
  ) => boolean;
  readStreamingMessageId: () => string | null;
};

export class AgentConversationToolCallManager {
  private readonly messageIdByCallId = new Map<string, string>();
  private readonly argsRawByCallId = new Map<string, string>();

  constructor(private readonly port: AgentConversationToolCallManagerPort) {}

  isEmpty = (): boolean =>
    this.messageIdByCallId.size === 0 && this.argsRawByCallId.size === 0;

  clear = (): void => {
    this.messageIdByCallId.clear();
    this.argsRawByCallId.clear();
  };

  hydrate = (messages: readonly NcpMessage[]): void => {
    this.clear();
    messages.forEach((message) => {
      message.parts.forEach((part) => {
        if (
          part.type !== "tool-invocation" ||
          !part.toolCallId ||
          part.state === "result" ||
          part.state === "cancelled"
        ) {
          return;
        }
        const args = typeof part.args === "string"
          ? part.args
          : JSON.stringify(part.args ?? {});
        this.messageIdByCallId.set(part.toolCallId, message.id);
        this.argsRawByCallId.set(part.toolCallId, args);
      });
    });
  };

  clearByMessageId = (messageId: string): void => {
    for (const [toolCallId, trackedMessageId] of this.messageIdByCallId) {
      if (trackedMessageId !== messageId) {
        continue;
      }
      this.messageIdByCallId.delete(toolCallId);
      this.argsRawByCallId.delete(toolCallId);
    }
  };

  markAborted = (toolCallIds: readonly string[]): void => {
    toolCallIds.forEach((toolCallId) => this.argsRawByCallId.set(toolCallId, ABORTED_TOOL_CALL_SENTINEL));
  };

  remapMessageId = (fromMessageId: string, toMessageId: string): void => {
    for (const [toolCallId, trackedMessageId] of this.messageIdByCallId) {
      if (trackedMessageId === fromMessageId) {
        this.messageIdByCallId.set(toolCallId, toMessageId);
      }
    }
  };

  handleToolCallStart = (payload: NcpToolCallStartPayload): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const targetMessage = this.resolveToolCallTargetMessage(payload.sessionId, payload.toolCallId, payload.messageId);
    this.argsRawByCallId.set(payload.toolCallId, "");
    this.port.replaceStreamingMessage({
      ...targetMessage,
      parts: upsertToolInvocationPart(targetMessage.parts, {
        type: "tool-invocation",
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        state: "partial-call",
        args: "",
      }),
      status: "streaming",
    });
  };

  handleToolCallArgs = (payload: NcpToolCallArgsPayload): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    this.argsRawByCallId.set(payload.toolCallId, payload.args);
    this.applyToolCallArgs(payload.sessionId, payload.toolCallId, payload.args);
  };

  handleToolCallArgsDelta = (payload: NcpToolCallArgsDeltaPayload): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const currentArgs = this.argsRawByCallId.get(payload.toolCallId) ?? "";
    const nextArgs = `${currentArgs}${payload.delta}`;
    this.argsRawByCallId.set(payload.toolCallId, nextArgs);
    this.applyToolCallArgs(payload.sessionId, payload.toolCallId, nextArgs, payload.messageId);
  };

  handleToolCallEnd = (payload: NcpToolCallEndPayload): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const targetMessage = this.resolveToolCallTargetMessage(payload.sessionId, payload.toolCallId);
    const args = this.argsRawByCallId.get(payload.toolCallId) ?? "";
    this.port.replaceStreamingMessage({
      ...targetMessage,
      parts: upsertToolInvocationPart(targetMessage.parts, {
        type: "tool-invocation",
        toolCallId: payload.toolCallId,
        toolName: findToolNameByCallId(targetMessage.parts, payload.toolCallId) ?? "unknown",
        state: "call",
        args,
      }),
      status: "streaming",
    });
  };

  handleToolExecutionStarted = (
    payload: NcpToolExecutionStartedPayload,
    occurredAt?: string,
  ): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const startedAt = normalizeToolExecutionTimestamp(occurredAt);
    if (!startedAt) return;
    const updated = this.port.updateMessageContainingToolCall(
      payload.toolCallId,
      (targetMessage, existingPart) => {
        if (hasTerminalExecution(existingPart)) return targetMessage.parts;
        const currentStartedAt = normalizeToolExecutionTimestamp(existingPart.execution?.startedAt);
        const earliestStartedAt =
          currentStartedAt && Date.parse(currentStartedAt) <= Date.parse(startedAt)
            ? currentStartedAt
            : startedAt;
        return upsertToolInvocationPart(targetMessage.parts, {
          ...existingPart,
          execution: {
            ...existingPart.execution,
            startedAt: earliestStartedAt,
          },
        });
      },
    );
    if (updated) return;
    const fallbackMessage = this.resolveToolCallTargetMessage(
      payload.sessionId,
      payload.toolCallId,
      payload.messageId,
    );
    this.port.replaceStreamingMessage({
      ...fallbackMessage,
      parts: upsertToolInvocationPart(fallbackMessage.parts, {
        type: "tool-invocation",
        toolCallId: payload.toolCallId,
        toolName: "unknown",
        state: "call",
        execution: { startedAt },
      }),
      status: "streaming",
    });
  };

  handleToolCallResult = (payload: NcpToolCallResultPayload, occurredAt?: string): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const isFinal = payload.final !== false;
    const execution = normalizeToolExecutionTiming(
      payload.execution,
      isFinal ? occurredAt : undefined,
    );
    const updated = this.port.updateMessageContainingToolCall(
      payload.toolCallId,
      (targetMessage, existingPart) => {
        if (existingPart.state === "cancelled") return targetMessage.parts;
        if (!isFinal && hasTerminalExecution(existingPart)) return targetMessage.parts;
        return upsertToolInvocationPart(targetMessage.parts, {
          type: "tool-invocation",
          toolCallId: payload.toolCallId,
          toolName: existingPart.toolName,
          state: isFinal ? "result" : "call",
          args: existingPart.args,
          result: payload.content,
          ...(payload.contentItems ? { resultContentItems: payload.contentItems } : {}),
          ...(execution
            ? { execution: mergeToolExecutionTiming(existingPart.execution, execution) }
            : {}),
        });
      },
    );
    if (updated) {
      return;
    }
    const fallbackMessage = this.resolveToolCallTargetMessage(
      payload.sessionId,
      payload.toolCallId,
    );
    this.port.replaceStreamingMessage({
      ...fallbackMessage,
      parts: upsertToolInvocationPart(fallbackMessage.parts, {
        type: "tool-invocation",
        toolCallId: payload.toolCallId,
        toolName: "unknown",
        state: isFinal ? "result" : "call",
        result: payload.content,
        ...(payload.contentItems ? { resultContentItems: payload.contentItems } : {}),
        ...(execution ? { execution } : {}),
      }),
      status: "streaming",
    });
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
    this.port.replaceStreamingMessage({
      ...targetMessage,
      parts: upsertToolInvocationPart(targetMessage.parts, {
        type: "tool-invocation",
        toolCallId,
        toolName,
        state: "partial-call",
        args,
      }),
      status: "streaming",
    });
  };

  private resolveToolCallTargetMessage = (
    sessionId: string,
    toolCallId: string,
    messageId?: string,
  ): NcpMessage => {
    const preferredMessageId =
      messageId?.trim() ||
      this.messageIdByCallId.get(toolCallId) ||
      this.port.readStreamingMessageId() ||
      `tool-${toolCallId}`;
    this.messageIdByCallId.set(toolCallId, preferredMessageId);
    return this.port.ensureStreamingMessage(sessionId, preferredMessageId, "streaming");
  };
}
