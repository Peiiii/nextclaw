import type {
  NcpMessage,
  NcpToolCallArgsDeltaPayload,
  NcpToolCallArgsPayload,
  NcpToolCallEndPayload,
  NcpToolCallResultPayload,
  NcpToolCallStartPayload,
} from "@nextclaw/ncp";
import {
  ABORTED_TOOL_CALL_SENTINEL,
  clearToolCallTrackingByMessageId,
  findToolNameByCallId,
  remapTrackedToolCallsToMessageId,
  upsertToolInvocationPart,
} from "./agent-conversation-state-manager.utils.js";

type ToolCallPart = Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>;

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

  clearByMessageId = (messageId: string): void => {
    clearToolCallTrackingByMessageId(
      this.messageIdByCallId,
      this.argsRawByCallId,
      messageId,
    );
  };

  markAborted = (toolCallIds: readonly string[]): void => {
    toolCallIds.forEach((toolCallId) => this.argsRawByCallId.set(toolCallId, ABORTED_TOOL_CALL_SENTINEL));
  };

  remapMessageId = (fromMessageId: string, toMessageId: string): void => {
    remapTrackedToolCallsToMessageId(
      this.messageIdByCallId,
      fromMessageId,
      toMessageId,
    );
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

  handleToolCallResult = (payload: NcpToolCallResultPayload): void => {
    if (this.argsRawByCallId.get(payload.toolCallId) === ABORTED_TOOL_CALL_SENTINEL) return;
    const updated = this.port.updateMessageContainingToolCall(
      payload.toolCallId,
      (targetMessage, existingPart) =>
        upsertToolInvocationPart(targetMessage.parts, {
          type: "tool-invocation",
          toolCallId: payload.toolCallId,
          toolName: existingPart.toolName,
          state: "result",
          args: existingPart.args,
          result: payload.content,
          resultContentItems: payload.contentItems,
        }),
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
        state: "result",
        result: payload.content,
        resultContentItems: payload.contentItems,
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
