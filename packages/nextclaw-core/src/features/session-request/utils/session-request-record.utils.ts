import type {
  SessionRequestNotifyMode,
  SessionRequestRecord,
  SessionRequestWaitMode,
} from "@core/features/session-request/types/session-request.types.js";
import type { NcpRunTriggerInput } from "@nextclaw/shared";

export function createRunningSessionRequest(params: {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  handoffDepth: number;
  notify: SessionRequestNotifyMode;
  wait: SessionRequestWaitMode;
  title: string;
  task: string;
  isChildSession: boolean;
  parentSessionId?: string;
  trigger: NcpRunTriggerInput;
}): SessionRequestRecord {
  const {
    requestId,
    sourceSessionId,
    targetSessionId,
    sourceToolCallId,
    handoffDepth,
    notify,
    wait,
    title,
    task,
    isChildSession,
    parentSessionId,
    trigger,
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
    wait,
    status: "running",
    createdAt,
    startedAt: createdAt,
    metadata: {
      title,
      task,
      is_child_session: isChildSession,
      ...(parentSessionId ? { parent_session_id: parentSessionId } : {}),
      run_trigger: structuredClone(trigger),
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
