import type { NcpCompletedEnvelope, NcpMessage } from "@nextclaw/ncp";
import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
} from "./session-request.types.js";

export function buildSessionRequestUserMessage(params: {
  sessionId: string;
  requestId: string;
  task: string;
}): NcpMessage {
  const { sessionId, requestId, task } = params;
  const timestamp = new Date().toISOString();
  return {
    id: `${sessionId}:user:session-request:${requestId}`,
    sessionId,
    role: "user",
    status: "final",
    timestamp,
    parts: [{ type: "text", text: task }],
    metadata: {
      session_request_id: requestId,
    },
  };
}

export function createRunningSessionRequest(params: {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  handoffDepth: number;
  notify: SessionRequestNotifyMode;
  title: string;
  task: string;
  isChildSession: boolean;
  parentSessionId?: string;
}): SessionRequestRecord {
  const {
    requestId,
    sourceSessionId,
    targetSessionId,
    sourceToolCallId,
    handoffDepth,
    notify,
    title,
    task,
    isChildSession,
    parentSessionId,
  } = params;
  const createdAt = new Date().toISOString();
  return {
    requestId,
    sourceSessionId,
    targetSessionId,
    sourceToolCallId,
    rootRequestId: requestId,
    handoffDepth,
    notify,
    status: "running",
    createdAt,
    startedAt: createdAt,
    metadata: {
      title,
      task,
      is_child_session: isChildSession,
      ...(parentSessionId ? { parent_session_id: parentSessionId } : {}),
    },
  };
}

export function createCompletedSessionRequest(params: {
  request: SessionRequestRecord;
  completedMessage: NcpCompletedEnvelope["message"];
  finalResponseText?: string;
}): SessionRequestRecord {
  const { request, completedMessage, finalResponseText } = params;
  return {
    ...request,
    status: "completed",
    completedAt: new Date().toISOString(),
    finalResponseMessageId: completedMessage?.id,
    finalResponseText,
  };
}

export function createFailedSessionRequest(params: {
  request: SessionRequestRecord;
  error: unknown;
}): SessionRequestRecord {
  const { request, error } = params;
  return {
    ...request,
    status: "failed",
    completedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
}
