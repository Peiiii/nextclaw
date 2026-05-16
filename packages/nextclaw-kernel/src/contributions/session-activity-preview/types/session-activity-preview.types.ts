export type SessionActivityPreviewState = "running" | "completed" | "failed" | "idle";

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
