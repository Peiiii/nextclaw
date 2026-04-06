import { resolveDefaultAgentProfileId, type Config, type SessionManager } from "@nextclaw/core";
import { randomUUID } from "node:crypto";
import type { SessionLifecycle, SessionRecord } from "./session-request.types.js";

const DEFAULT_SESSION_TYPE = "native";
const DEFAULT_LIFECYCLE: SessionLifecycle = "persistent";
const SESSION_METADATA_LABEL_KEY = "label";

export const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
export const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
export const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";
export const CHILD_SESSION_PROMOTED_METADATA_KEY = "child_session_promoted";

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
  if (normalized.length <= 72) {
    return normalized;
  }
  return `${normalized.slice(0, 69)}...`;
}

function cloneInheritedMetadata(
  sourceMetadata: Record<string, unknown>,
): Record<string, unknown> {
  const nextMetadata: Record<string, unknown> = {};
  const inheritedKeys = [
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
    if (!Object.prototype.hasOwnProperty.call(sourceMetadata, key)) {
      continue;
    }
    nextMetadata[key] = structuredClone(sourceMetadata[key]);
  }
  return nextMetadata;
}

function buildSessionId(): string {
  return `ncp-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function resolveSessionAgentId(params: {
  agentId?: string;
  getConfig: () => Config;
}): string {
  return readOptionalString(params.agentId) ?? resolveDefaultAgentProfileId(params.getConfig());
}

function resolveSessionTitle(params: { title?: string; task: string }): string {
  return readOptionalString(params.title) ?? summarizeTask(params.task);
}

function resolveSessionType(params: {
  sessionType?: string;
  metadata: Record<string, unknown>;
}): string {
  return (
    readOptionalString(params.sessionType) ??
    readOptionalString(params.metadata.session_type) ??
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
  params.metadata.session_type = params.sessionType;
  params.metadata[SESSION_METADATA_LABEL_KEY] = params.title;
  params.metadata[CHILD_SESSION_LIFECYCLE_METADATA_KEY] = params.lifecycle;
  if (params.parentSessionId) {
    params.metadata[CHILD_SESSION_PARENT_METADATA_KEY] = params.parentSessionId;
    params.metadata[CHILD_SESSION_PROMOTED_METADATA_KEY] = false;
  }
  if (params.requestId) {
    params.metadata[CHILD_SESSION_REQUEST_METADATA_KEY] = params.requestId;
  }
  if (readOptionalString(params.model)) {
    params.metadata.model = params.model?.trim();
    params.metadata.preferred_model = params.model?.trim();
  }
  if (readOptionalString(params.thinkingLevel)) {
    params.metadata.thinking = params.thinkingLevel?.trim();
    params.metadata.preferred_thinking = params.thinkingLevel?.trim();
  }
  if (readOptionalString(params.projectRoot)) {
    params.metadata.project_root = params.projectRoot?.trim();
  }
}

export class SessionCreationService {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly getConfig: () => Config,
    private readonly onSessionUpdated?: (sessionKey: string) => void,
  ) {}

  createSession = (params: {
    task: string;
    title?: string;
    sourceSessionMetadata: Record<string, unknown>;
    agentId?: string;
    model?: string;
    thinkingLevel?: string;
    sessionType?: string;
    projectRoot?: string | null;
    parentSessionId?: string;
    requestId?: string;
  }): SessionRecord => {
    const sessionId = buildSessionId();
    const now = new Date().toISOString();
    const session = this.sessionManager.getOrCreate(sessionId);
    const resolvedAgentId = resolveSessionAgentId({
      agentId: params.agentId,
      getConfig: this.getConfig,
    });
    const title = resolveSessionTitle({
      title: params.title,
      task: params.task,
    });
    const metadata = cloneInheritedMetadata(params.sourceSessionMetadata);
    const parentSessionId = readOptionalString(params.parentSessionId);
    const requestId = readOptionalString(params.requestId);
    const sessionType = resolveSessionType({
      sessionType: params.sessionType,
      metadata,
    });
    applySessionOverrides({
      metadata,
      sessionType,
      title,
      lifecycle: DEFAULT_LIFECYCLE,
      parentSessionId,
      requestId,
      model: params.model,
      thinkingLevel: params.thinkingLevel,
      projectRoot: params.projectRoot,
    });

    session.agentId = resolvedAgentId;
    session.metadata = metadata;
    session.updatedAt = new Date(now);
    this.sessionManager.save(session);
    this.onSessionUpdated?.(sessionId);

    return {
      sessionId,
      agentId: resolvedAgentId,
      sessionType,
      runtimeFamily: "native",
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(requestId ? { spawnedByRequestId: requestId } : {}),
      lifecycle: DEFAULT_LIFECYCLE,
      title,
      metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  };

  createChildSession = (params: {
    parentSessionId: string;
    task: string;
    title?: string;
    sourceSessionMetadata: Record<string, unknown>;
    agentId?: string;
    model?: string;
    thinkingLevel?: string;
    sessionType?: string;
    projectRoot?: string | null;
    requestId?: string;
  }): SessionRecord => {
    return this.createSession(params);
  };

  promoteChildSession = (params: { sessionId: string; promoted: boolean }): boolean => {
    const session = this.sessionManager.getIfExists(params.sessionId);
    if (!session) {
      return false;
    }
    session.metadata = {
      ...session.metadata,
      [CHILD_SESSION_PROMOTED_METADATA_KEY]: params.promoted,
    };
    session.updatedAt = new Date();
    this.sessionManager.save(session);
    this.onSessionUpdated?.(params.sessionId);
    return true;
  };

  isChildSessionRecord = (metadata: Record<string, unknown> | null | undefined): boolean => {
    return Boolean(readOptionalString(metadata?.[CHILD_SESSION_PARENT_METADATA_KEY]));
  };
}
