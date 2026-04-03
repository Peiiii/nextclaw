export type SessionLifecycle = "persistent" | "ephemeral";

export type SessionRequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SessionRequestAwaitMode = "final_reply";

export type SessionRequestDeliveryMode =
  | "none"
  | "resume_source";

export type SessionRecord = {
  sessionId: string;
  sessionType: string;
  runtimeFamily: "native" | "external";
  parentSessionId?: string;
  spawnedByRequestId?: string;
  lifecycle: SessionLifecycle;
  title?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SessionRequestRecord = {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  rootRequestId: string;
  parentRequestId?: string;
  handoffDepth: number;
  awaitMode: SessionRequestAwaitMode;
  deliveryMode: SessionRequestDeliveryMode;
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
  targetKind: "child" | "session";
  parentSessionId?: string;
  spawnedByRequestId?: string;
  isChildSession: boolean;
  lifecycle: SessionLifecycle;
  title?: string;
  task: string;
  status: SessionRequestStatus;
  awaitMode: SessionRequestAwaitMode;
  deliveryMode: SessionRequestDeliveryMode;
  finalResponseText?: string;
  error?: string;
  message?: string;
};
