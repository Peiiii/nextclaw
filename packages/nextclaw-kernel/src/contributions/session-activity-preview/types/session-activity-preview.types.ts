export type SessionActivityPreviewState = "running" | "completed" | "failed" | "cancelled" | "idle";

export type SessionActivityPreviewStatusKind =
  | "thinking"
  | "tool-running"
  | "tool-completed"
  | "run-failed"
  | "run-interrupted";

export type SessionActivityPreviewMetadata = {
  state: SessionActivityPreviewState;
  timestamp: string;
  statusKind?: SessionActivityPreviewStatusKind;
  statusText?: string;
  replyText?: string;
};

export type SessionActivityPreviewProjection = {
  sessionId: string;
  preview: SessionActivityPreviewMetadata;
};
