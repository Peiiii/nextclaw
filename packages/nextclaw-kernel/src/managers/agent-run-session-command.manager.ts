import { randomUUID } from "node:crypto";
import {
  CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY,
  isSilentReplyNcpMessage,
} from "@nextclaw/shared";
import {
  isHiddenNcpMessage,
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  type NcpMessage,
} from "@nextclaw/ncp";
import { SESSION_ACTIVITY_PREVIEW_METADATA_KEY } from "@kernel/contributions/session-activity-preview/index.js";
import type {
  AgentRunAccepted,
  AgentRunContinueRequest,
  AgentRunEditMessageRequest,
  AgentRunRequest,
} from "@kernel/types/agent-run.types.js";
import type { SessionManager } from "./session.manager.js";
import type { SessionRunManager } from "./session-run.manager.js";

const CONTINUATION_PROMPT =
  "Continue from where you stopped. Preserve completed work and avoid repeating it.";

type PendingSessionCommand = {
  key: string;
  promise: Promise<AgentRunAccepted>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSendableMessageContent(message: NcpMessage): boolean {
  return message.parts.some((part) =>
    part.type === "text" || part.type === "rich-text" || part.type === "reasoning"
      ? part.text.trim().length > 0
      : true,
  );
}

function readSessionActivityState(
  metadata: Record<string, unknown> | undefined,
): string | null {
  const preview = metadata?.[SESSION_ACTIVITY_PREVIEW_METADATA_KEY];
  return isRecord(preview) && typeof preview.state === "string"
    ? preview.state
    : null;
}

export class AgentRunSessionCommandManager {
  private readonly pendingCommands = new Map<string, PendingSessionCommand>();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
    private readonly send: (request: AgentRunRequest) => Promise<AgentRunAccepted>,
  ) {}

  dispose = (): void => {
    this.pendingCommands.clear();
  };

  editMessage = async (
    request: AgentRunEditMessageRequest,
  ): Promise<AgentRunAccepted> => {
    const sessionId = request.sessionId.trim();
    const messageId = request.messageId.trim();
    if (!sessionId || !messageId) {
      throw new Error("Editing a message requires sessionId and messageId.");
    }
    if (this.sessionRunManager.isSessionRunning(sessionId)) {
      throw new Error("Cannot edit a message while the source session is running.");
    }
    if (
      request.message.role !== "user" ||
      isHiddenNcpMessage(request.message) ||
      !hasSendableMessageContent(request.message)
    ) {
      throw new Error("The edited message must be a visible, non-empty user message.");
    }
    return await this.runCommand(
      sessionId,
      `edit-message:${messageId}`,
      () => this.editMessageOnce({ ...request, messageId, sessionId }),
    );
  };

  continueRun = async (
    request: AgentRunContinueRequest,
  ): Promise<AgentRunAccepted> => {
    const sessionId = request.sessionId.trim();
    if (!sessionId) {
      throw new Error("Continuing a run requires sessionId.");
    }
    if (this.sessionRunManager.isSessionRunning(sessionId)) {
      throw new Error("Cannot continue a session that is already running.");
    }
    return await this.runCommand(
      sessionId,
      "continue-run",
      () => this.continueRunOnce({ ...request, sessionId }),
    );
  };

  private editMessageOnce = async (
    request: AgentRunEditMessageRequest,
  ): Promise<AgentRunAccepted> => {
    const sourceRecord = await this.sessionManager.getSessionRecord(request.sessionId);
    if (!sourceRecord) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }
    const latestUserMessage = [...sourceRecord.messages]
      .reverse()
      .find((message) => message.role === "user" && !isHiddenNcpMessage(message));
    if (!latestUserMessage || latestUserMessage.id !== request.messageId) {
      throw new Error("Only the latest visible user message can be edited.");
    }
    const sessionRun = await this.sessionRunManager.getOrCreateSessionRun(request.sessionId);
    if (sessionRun.isBusy()) {
      throw new Error("Cannot edit a message while the session is running.");
    }
    const rewoundRecord = await this.sessionManager.rewindSessionBeforeMessage(
      request.sessionId,
      request.messageId,
    );
    sessionRun.replaceMessages(rewoundRecord.messages);
    return await this.send({
      correlationId: request.correlationId,
      sessionId: request.sessionId,
      message: {
        ...structuredClone(request.message),
        sessionId: request.sessionId,
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
      },
      trigger: {
        actor: "human",
        source: "message-edit",
        triggeredAt: new Date().toISOString(),
        sourceSessionId: request.sessionId,
        sourceMessageId: request.messageId,
      },
    });
  };

  private continueRunOnce = async (
    request: AgentRunContinueRequest,
  ): Promise<AgentRunAccepted> => {
    const sourceRecord = await this.sessionManager.getSessionRecord(request.sessionId);
    if (!sourceRecord) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }
    const activityState = readSessionActivityState(sourceRecord.metadata);
    if (activityState !== "cancelled" && activityState !== "failed") {
      throw new Error("Only a cancelled or failed session can continue running.");
    }
    const latestVisibleConversationMessage = [...sourceRecord.messages]
      .reverse()
      .find((message) =>
        (message.role === "user" || message.role === "assistant") &&
        !isHiddenNcpMessage(message) &&
        !isSilentReplyNcpMessage(message),
      );
    const triggeredAt = new Date().toISOString();
    return await this.send({
      correlationId: request.correlationId,
      sessionId: request.sessionId,
      message: {
        id: `continuation-message-${randomUUID()}`,
        sessionId: request.sessionId,
        role: "user",
        status: "final",
        timestamp: triggeredAt,
        parts: [{ type: "text", text: CONTINUATION_PROMPT }],
        metadata: {
          [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
          [CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY]:
            latestVisibleConversationMessage?.role === "assistant"
              ? latestVisibleConversationMessage.id
              : undefined,
        },
      },
      trigger: {
        actor: "human",
        source: "continue-run",
        triggeredAt,
        sourceSessionId: request.sessionId,
        ...(latestVisibleConversationMessage
          ? { sourceMessageId: latestVisibleConversationMessage.id }
          : {}),
      },
    });
  };

  private runCommand = async (
    sessionId: string,
    commandKey: string,
    command: () => Promise<AgentRunAccepted>,
  ): Promise<AgentRunAccepted> => {
    const pending = this.pendingCommands.get(sessionId);
    if (pending) {
      if (pending.key !== commandKey) {
        throw new Error("Another command is already changing this session.");
      }
      return await pending.promise;
    }
    const operation = command().finally(() => {
      if (this.pendingCommands.get(sessionId)?.promise === operation) {
        this.pendingCommands.delete(sessionId);
      }
    });
    this.pendingCommands.set(sessionId, { key: commandKey, promise: operation });
    return await operation;
  };
}
