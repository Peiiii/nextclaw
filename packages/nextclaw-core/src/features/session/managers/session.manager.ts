import { randomUUID } from "node:crypto";
import { BUILTIN_MAIN_AGENT_ID } from "@core/features/config/index.js";
import {
  SessionStore,
  type Session,
  type SessionEvent,
} from "@core/features/session/stores/session.store.js";
import type { SessionListRecord } from "@core/features/session/types/session-list.types.js";

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

export type CreateSessionInput = {
  sourceSessionId?: string;
  sourceSessionMetadata: Record<string, unknown>;
  metadataOverrides?: Record<string, unknown>;
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

export type SessionManagerOptions = {
  sessionsDir: string;
};

const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_LIFECYCLE: SessionLifecycle = "persistent";
const SESSION_METADATA_LABEL_KEY = "label";

export const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
export const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
export const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function summarizeTask(task: string): string {
  const normalized = task.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Session";
  }
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69)}...`;
}

function cloneInheritedMetadata(sourceMetadata: Record<string, unknown>): Record<string, unknown> {
  const nextMetadata: Record<string, unknown> = {};
  const inheritedKeys = [
    "runtime",
    "session_type",
    "preferred_model",
    "preferred_thinking",
    "project_root",
    "requested_skill_refs",
    "codex_runtime_backend",
    "reasoningNormalizationMode",
    "reasoning_normalization_mode",
  ];
  for (const key of inheritedKeys) {
    if (Object.prototype.hasOwnProperty.call(sourceMetadata, key)) {
      nextMetadata[key] = structuredClone(sourceMetadata[key]);
    }
  }
  return nextMetadata;
}

function mergeMetadataOverrides(
  metadata: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return overrides && Object.keys(overrides).length > 0
    ? { ...metadata, ...structuredClone(overrides) }
    : metadata;
}

function buildSessionId(): string {
  return `ncp-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function resolveSessionTitle(params: { title?: string; task: string }): string {
  return readOptionalString(params.title) ?? summarizeTask(params.task);
}

function resolveSessionType(params: {
  runtime?: string;
  sessionType?: string;
  metadata: Record<string, unknown>;
}): string {
  const { metadata, runtime, sessionType } = params;
  return (
    readOptionalString(runtime) ??
    readOptionalString(metadata.runtime) ??
    readOptionalString(sessionType) ??
    readOptionalString(metadata.session_type) ??
    DEFAULT_SESSION_TYPE
  );
}

function applySessionOverrides(params: {
  metadata: Record<string, unknown>;
  sessionType: string;
  title: string;
  lifecycle: SessionLifecycle;
  parentSessionId: string | null;
  requestId: string | null;
  model?: string;
  thinkingLevel?: string;
  projectRoot?: string | null;
}): void {
  const {
    lifecycle,
    metadata,
    model,
    parentSessionId,
    projectRoot,
    requestId,
    sessionType,
    thinkingLevel,
    title,
  } = params;
  metadata.session_type = sessionType;
  metadata.runtime = sessionType;
  metadata[SESSION_METADATA_LABEL_KEY] = title;
  metadata[CHILD_SESSION_LIFECYCLE_METADATA_KEY] = lifecycle;
  if (parentSessionId) {
    metadata[CHILD_SESSION_PARENT_METADATA_KEY] = parentSessionId;
  }
  if (requestId) {
    metadata[CHILD_SESSION_REQUEST_METADATA_KEY] = requestId;
  }
  if (readOptionalString(model)) {
    metadata.model = model?.trim();
    metadata.preferred_model = model?.trim();
  }
  if (readOptionalString(thinkingLevel)) {
    metadata.thinking = thinkingLevel?.trim();
    metadata.preferred_thinking = thinkingLevel?.trim();
  }
  if (readOptionalString(projectRoot)) {
    metadata.project_root = projectRoot?.trim();
  }
}

export class SessionManager {
  private readonly store: SessionStore;

  constructor(options: SessionManagerOptions) {
    this.store = new SessionStore({
      sessionsDir: options.sessionsDir,
    });
  }

  createSession = (params: CreateSessionInput): CreatedSession => {
    const {
      agentId,
      metadataOverrides,
      model,
      parentSessionId: rawParentSessionId,
      projectRoot,
      requestId: rawRequestId,
      runtime,
      sessionType: requestedSessionType,
      sourceSessionId,
      sourceSessionMetadata,
      task,
      thinkingLevel,
      title: requestedTitle,
    } = params;
    const sessionId = buildSessionId();
    const session = this.getOrCreate(sessionId);
    const title = resolveSessionTitle({ title: requestedTitle, task });
    const metadata = cloneInheritedMetadata(sourceSessionMetadata);
    const parentSessionId = readOptionalString(rawParentSessionId);
    const requestId = readOptionalString(rawRequestId);
    const sessionType = resolveSessionType({
      runtime,
      sessionType: requestedSessionType,
      metadata,
    });
    applySessionOverrides({
      metadata,
      sessionType,
      title,
      lifecycle: DEFAULT_LIFECYCLE,
      parentSessionId,
      requestId,
      model,
      thinkingLevel,
      projectRoot,
    });
    const nextMetadata = mergeMetadataOverrides(metadata, metadataOverrides);
    const sourceAgentId = sourceSessionId ? this.getIfExists(sourceSessionId)?.agentId : undefined;
    const resolvedAgentId = readOptionalString(agentId) ?? sourceAgentId ?? BUILTIN_MAIN_AGENT_ID;

    session.agentId = resolvedAgentId;
    session.metadata = nextMetadata;
    session.updatedAt = new Date();
    this.save(session);

    return {
      sessionId,
      agentId: resolvedAgentId,
      sessionType,
      runtimeFamily: sessionType === DEFAULT_SESSION_TYPE ? "native" : "external",
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(requestId ? { spawnedByRequestId: requestId } : {}),
      lifecycle: DEFAULT_LIFECYCLE,
      title,
      metadata: nextMetadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  };

  getOrCreate = (key: string): Session => this.store.getOrCreate(key);

  getIfExists = (key: string): Session | null => this.store.getIfExists(key);

  appendEvent = (
    session: Session,
    params: {
      type: string;
      data?: Record<string, unknown>;
      timestamp?: string;
    },
  ): SessionEvent => this.store.appendEvent(session, params);

  addMessage = (
    session: Session,
    role: string,
    content: unknown,
    extra: Record<string, unknown> = {},
  ): SessionEvent => this.store.addMessage(session, role, content, extra);

  getHistory = (session: Session, maxMessages = 50): Array<Record<string, unknown>> =>
    this.store.getHistory(session, maxMessages);

  clear = (session: Session): void => {
    this.store.clear(session);
  };

  save = (session: Session): void => {
    this.store.save(session);
  };

  delete = (key: string): boolean => this.store.delete(key);

  listSessions = (): SessionListRecord[] => this.store.listSessions();
}
