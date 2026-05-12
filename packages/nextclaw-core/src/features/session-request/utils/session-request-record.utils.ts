import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
} from "../types/session-request.types.js";

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
  finalResponseMessageId?: string;
  finalResponseText?: string;
}): SessionRequestRecord {
  const { request, finalResponseMessageId, finalResponseText } = params;
  return {
    ...request,
    status: "completed",
    completedAt: new Date().toISOString(),
    ...(finalResponseMessageId ? { finalResponseMessageId } : {}),
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
