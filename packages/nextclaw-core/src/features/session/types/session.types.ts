export type SessionLifecycle = "persistent" | "ephemeral";

export type CreatedSession = {
  sessionId: string;
  agentId?: string;
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

export type CreateSessionContextInheritanceInput = {
  anchorToolCallId?: string;
};

export type CreateSessionInput = {
  sessionId?: string;
  sourceSessionId?: string;
  sourceSessionMetadata: Record<string, unknown>;
  metadataOverrides?: Record<string, unknown>;
  contextInheritance?: CreateSessionContextInheritanceInput;
  task: string;
  title?: string;
  agentId?: string;
  model?: string;
  runtime?: string;
  thinkingLevel?: string;
  sessionType?: string;
  projectRoot?: string | null;
  parentSessionId?: string;
  requestId?: string;
};

export const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
export const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
export const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";
