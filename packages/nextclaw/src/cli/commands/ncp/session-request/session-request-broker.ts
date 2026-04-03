import type { SessionManager } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpCompletedEnvelope,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import { randomUUID } from "node:crypto";
import {
  ChildSessionService,
  CHILD_SESSION_PARENT_METADATA_KEY,
} from "./child-session.service.js";
import { SessionRequestDeliveryService } from "./session-request-delivery.service.js";
import type {
  SessionRequestAwaitMode,
  SessionRequestDeliveryMode,
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function summarizeTask(task: string): string {
  const normalized = task.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Session request";
  }
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}

function buildUserMessage(params: {
  sessionId: string;
  requestId: string;
  task: string;
}): NcpMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `${params.sessionId}:user:session-request:${params.requestId}`,
    sessionId: params.sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: params.task }],
    metadata: {
      session_request_id: params.requestId,
    },
  };
}

function extractMessageText(message: NcpMessage | undefined): string | undefined {
  if (!message) {
    return undefined;
  }
  const parts = message.parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "rich-text") {
        return [part.text];
      }
      return [];
    })
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join("\n\n");
}

function findLatestAssistantMessage(messages: readonly NcpMessage[]): NcpMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message;
    }
  }
  return undefined;
}

function readParentSessionId(metadata: Record<string, unknown> | undefined): string | undefined {
  return readOptionalString(metadata?.[CHILD_SESSION_PARENT_METADATA_KEY]) ?? undefined;
}

function buildToolResult(params: {
  request: SessionRequestRecord;
  task: string;
  title: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
  message?: string;
}): SessionRequestToolResult {
  return {
    kind: "nextclaw.session_request",
    requestId: params.request.requestId,
    sessionId: params.request.targetSessionId,
    targetKind: params.isChildSession ? "child" : "session",
    ...(params.parentSessionId ? { parentSessionId: params.parentSessionId } : {}),
    ...(params.spawnedByRequestId
      ? { spawnedByRequestId: params.spawnedByRequestId }
      : {}),
    isChildSession: params.isChildSession,
    lifecycle: "persistent",
    ...(params.title.trim() ? { title: params.title } : {}),
    task: params.task,
    status: params.request.status,
    awaitMode: params.request.awaitMode,
    deliveryMode: params.request.deliveryMode,
    ...(params.request.finalResponseText
      ? { finalResponseText: params.request.finalResponseText }
      : {}),
    ...(params.request.error ? { error: params.request.error } : {}),
    ...(params.message ? { message: params.message } : {}),
  };
}

export class SessionRequestBroker {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly childSessionService: ChildSessionService,
    private readonly deliveryService: SessionRequestDeliveryService,
    private readonly resolveBackend: () => DefaultNcpAgentBackend | null,
    private readonly onSessionUpdated?: (sessionKey: string) => void,
  ) {}

  spawnChildSessionAndRequest = async (params: {
    sourceSessionId: string;
    sourceToolCallId?: string;
    sourceSessionMetadata: Record<string, unknown>;
    task: string;
    title?: string;
    model?: string;
    handoffDepth?: number;
    sessionType?: string;
    thinkingLevel?: string;
    projectRoot?: string | null;
    agentId?: string;
  }): Promise<SessionRequestToolResult> => {
    const requestId = randomUUID();
    const childSession = this.childSessionService.createChildSession({
      parentSessionId: params.sourceSessionId,
      task: params.task,
      title: params.title,
      sourceSessionMetadata: params.sourceSessionMetadata,
      agentId: params.agentId,
      model: params.model,
      thinkingLevel: params.thinkingLevel,
      sessionType: params.sessionType,
      projectRoot: params.projectRoot,
      requestId,
    });

    return this.dispatchRequest({
      requestId,
      sourceSessionId: params.sourceSessionId,
      sourceToolCallId: params.sourceToolCallId,
      targetSessionId: childSession.sessionId,
      task: params.task,
      title: childSession.title ?? summarizeTask(params.task),
      handoffDepth: params.handoffDepth ?? 0,
      awaitMode: "final_reply",
      deliveryMode: "resume_source",
      isChildSession: true,
      parentSessionId: params.sourceSessionId,
      spawnedByRequestId: requestId,
    });
  };

  requestSession = async (params: {
    sourceSessionId: string;
    sourceToolCallId?: string;
    targetSessionId: string;
    task: string;
    title?: string;
    awaitMode: SessionRequestAwaitMode;
    deliveryMode: SessionRequestDeliveryMode;
    handoffDepth?: number;
  }): Promise<SessionRequestToolResult> => {
    if (params.targetSessionId.trim() === params.sourceSessionId.trim()) {
      throw new Error("sessions_request cannot target the current session.");
    }
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error("NCP backend is not ready for session requests.");
    }
    const targetSummary = await backend.getSession(params.targetSessionId.trim());
    if (!targetSummary) {
      throw new Error(`Target session not found: ${params.targetSessionId}`);
    }
    const parentSessionId = readParentSessionId(targetSummary.metadata);

    return this.dispatchRequest({
      requestId: randomUUID(),
      sourceSessionId: params.sourceSessionId,
      sourceToolCallId: params.sourceToolCallId,
      targetSessionId: params.targetSessionId.trim(),
      task: params.task,
      title:
        readOptionalString(params.title) ??
        readOptionalString(targetSummary.metadata?.label) ??
        summarizeTask(params.task),
      handoffDepth: params.handoffDepth ?? 0,
      awaitMode: params.awaitMode,
      deliveryMode: params.deliveryMode,
      isChildSession: Boolean(parentSessionId),
      parentSessionId: parentSessionId ?? undefined,
      spawnedByRequestId: undefined,
    });
  };

  private dispatchRequest = async (params: {
    requestId: string;
    sourceSessionId: string;
    sourceToolCallId?: string;
    targetSessionId: string;
    task: string;
    title: string;
    handoffDepth: number;
    awaitMode: SessionRequestAwaitMode;
    deliveryMode: SessionRequestDeliveryMode;
    isChildSession: boolean;
    parentSessionId?: string;
    spawnedByRequestId?: string;
  }): Promise<SessionRequestToolResult> => {
    const createdAt = new Date().toISOString();
    const request: SessionRequestRecord = {
      requestId: params.requestId,
      sourceSessionId: params.sourceSessionId,
      targetSessionId: params.targetSessionId,
      sourceToolCallId: params.sourceToolCallId,
      rootRequestId: params.requestId,
      handoffDepth: params.handoffDepth,
      awaitMode: params.awaitMode,
      deliveryMode: params.deliveryMode,
      status: "running",
      createdAt,
      startedAt: createdAt,
      metadata: {
        title: params.title,
        task: params.task,
        is_child_session: params.isChildSession,
        ...(params.parentSessionId ? { parent_session_id: params.parentSessionId } : {}),
      },
    };

    void this.runRequest({
      request,
      task: params.task,
      title: params.title,
      isChildSession: params.isChildSession,
      parentSessionId: params.parentSessionId,
    }).catch((error) => {
      console.error(
        `[session-request] Background request ${params.requestId} crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return buildToolResult({
      request,
      task: params.task,
      title: params.title,
      isChildSession: params.isChildSession,
      parentSessionId: params.parentSessionId,
      spawnedByRequestId: params.spawnedByRequestId,
      message: `Session request started. You'll receive the final reply when it finishes.`,
    });
  };

  private runRequest = async (params: {
    request: SessionRequestRecord;
    task: string;
    title: string;
    isChildSession: boolean;
    parentSessionId?: string;
    spawnedByRequestId?: string;
  }): Promise<void> => {
    let completedMessage: NcpCompletedEnvelope["message"] | undefined;

    try {
      const backend = this.resolveBackend();
      if (!backend) {
        throw new Error("NCP backend is not ready for session request execution.");
      }
      const message = buildUserMessage({
        sessionId: params.request.targetSessionId,
        requestId: params.request.requestId,
        task: params.task,
      });
      for await (const event of backend.send({
        sessionId: params.request.targetSessionId,
        message,
      })) {
        if (event.type === NcpEventType.MessageAccepted) {
          this.handleRequestEvent(params.request, event);
          continue;
        }
        if (event.type === NcpEventType.MessageFailed) {
          throw new Error(event.payload.error.message);
        }
        if (event.type === NcpEventType.RunError) {
          throw new Error(event.payload.error ?? "Session request failed.");
        }
        if (event.type === NcpEventType.MessageCompleted) {
          completedMessage = event.payload.message;
        }
      }
      if (!completedMessage) {
        const targetMessages = await backend.listSessionMessages(
          params.request.targetSessionId,
        );
        completedMessage = findLatestAssistantMessage(targetMessages);
      }
      if (!completedMessage) {
        throw new Error("Session request completed without a final reply.");
      }

      const completedAt = new Date().toISOString();
      const finalResponseText = extractMessageText(completedMessage);
      const completedRequest: SessionRequestRecord = {
        ...params.request,
        status: "completed",
        completedAt,
        finalResponseMessageId: completedMessage?.id,
        finalResponseText,
      };
      this.appendRequestEvent(params.request.sourceSessionId, "session.request.completed", completedRequest);
      this.appendRequestEvent(params.request.targetSessionId, "session.request.completed", completedRequest);

      const result = buildToolResult({
        request: completedRequest,
        task: params.task,
        title: params.title,
        isChildSession: params.isChildSession,
        parentSessionId: params.parentSessionId,
        spawnedByRequestId: params.spawnedByRequestId,
      });
      await this.deliveryService.publishToolResult({
        request: completedRequest,
        result,
      });
      if (completedRequest.deliveryMode === "resume_source") {
        await this.deliveryService.resumeSourceSession({
          request: completedRequest,
          result,
        });
      }
    } catch (error) {
      const completedAt = new Date().toISOString();
      const failedRequest: SessionRequestRecord = {
        ...params.request,
        status: "failed",
        completedAt,
        error: error instanceof Error ? error.message : String(error),
      };
      this.appendRequestEvent(params.request.sourceSessionId, "session.request.failed", failedRequest);
      this.appendRequestEvent(params.request.targetSessionId, "session.request.failed", failedRequest);

      const result = buildToolResult({
        request: failedRequest,
        task: params.task,
        title: params.title,
        isChildSession: params.isChildSession,
        parentSessionId: params.parentSessionId,
        spawnedByRequestId: params.spawnedByRequestId,
      });
      await this.deliveryService.publishToolResult({
        request: failedRequest,
        result,
      });
      if (failedRequest.deliveryMode === "resume_source") {
        await this.deliveryService.resumeSourceSession({
          request: failedRequest,
          result,
        });
      }
    }
  };

  private handleRequestEvent = (
    request: SessionRequestRecord,
    event: NcpEndpointEvent,
  ): void => {
    if (event.type === NcpEventType.MessageAccepted) {
      const acceptedRequest: SessionRequestRecord = {
        ...request,
        targetMessageId: event.payload.messageId,
      };
      this.appendRequestEvent(request.sourceSessionId, "session.request.accepted", acceptedRequest);
      this.appendRequestEvent(request.targetSessionId, "session.request.accepted", acceptedRequest);
    }
  };

  private appendRequestEvent = (
    sessionId: string,
    type: string,
    request: SessionRequestRecord,
  ): void => {
    const session = this.sessionManager.getOrCreate(sessionId);
    this.sessionManager.appendEvent(session, {
      type,
      data: {
        request: structuredClone(request),
      },
    });
    this.sessionManager.save(session);
    this.onSessionUpdated?.(sessionId);
  };
}
