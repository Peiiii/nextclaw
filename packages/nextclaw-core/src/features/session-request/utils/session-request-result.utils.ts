import { CHILD_SESSION_PARENT_METADATA_KEY } from "../../session/managers/session.manager.js";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "../types/session-request.types.js";

export function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function summarizeSessionRequestTask(task: string): string {
  const normalized = task.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Session request";
  }
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}

export function readParentSessionId(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  return readOptionalString(metadata?.[CHILD_SESSION_PARENT_METADATA_KEY]) ?? undefined;
}

export function buildSessionRequestToolResult(params: {
  request: SessionRequestRecord;
  task: string;
  title: string;
  agentId?: string;
  isChildSession: boolean;
  parentSessionId?: string;
  spawnedByRequestId?: string;
  message?: string;
}): SessionRequestToolResult {
  const {
    request,
    task,
    title,
    agentId,
    isChildSession,
    parentSessionId,
    spawnedByRequestId,
    message,
  } = params;
  return {
    kind: "nextclaw.session_request",
    requestId: request.requestId,
    sessionId: request.targetSessionId,
    ...(agentId ? { agentId } : {}),
    targetKind: isChildSession ? "child" : "session",
    ...(parentSessionId ? { parentSessionId } : {}),
    ...(spawnedByRequestId
      ? { spawnedByRequestId }
      : {}),
    isChildSession,
    lifecycle: "persistent",
    ...(title.trim() ? { title } : {}),
    task,
    status: request.status,
    notify: request.notify,
    ...(request.finalResponseText
      ? { finalResponseText: request.finalResponseText }
      : {}),
    ...(request.error ? { error: request.error } : {}),
    ...(message ? { message } : {}),
  };
}
