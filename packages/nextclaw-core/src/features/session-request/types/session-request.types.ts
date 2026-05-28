import type { SessionLifecycle } from "@core/features/session/index.js";

export type SessionRequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SessionRequestNotifyMode = "none" | "final_reply";

export type SessionRequestRecord = {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  rootRequestId: string;
  parentRequestId?: string;
  handoffDepth: number;
  notify: SessionRequestNotifyMode;
  status: SessionRequestStatus;
  targetMessageId?: string;
  finalResponseMessageId?: string;
  finalResponseText?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
};

export type SessionRequestToolResult = {
  kind: "nextclaw.session_request";
  requestId: string;
  sessionId: string;
  agentId?: string;
  targetKind: "child" | "session";
  parentSessionId?: string;
  spawnedByRequestId?: string;
  isChildSession: boolean;
  lifecycle: SessionLifecycle;
  title?: string;
  task: string;
  status: SessionRequestStatus;
  notify: SessionRequestNotifyMode;
  finalResponseText?: string;
  error?: string;
  message?: string;
};
