export type SessionActivityPreviewState = "running" | "completed" | "failed" | "cancelled" | "idle";

export type SessionActivityPreviewMetadata = {
  state: SessionActivityPreviewState;
  timestamp: string;
  statusText?: string;
  replyText?: string;
};

export type SessionActivityPreviewProjection = {
  sessionId: string;
  preview: SessionActivityPreviewMetadata;
};
