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
    if (!Object.prototype.hasOwnProperty.call(sourceMetadata, key)) {
      continue;
    }
    nextMetadata[key] = structuredClone(sourceMetadata[key]);
  }
  return nextMetadata;
}

function mergeMetadataOverrides(
  metadata: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) {
    return metadata;
  }
  return {
    ...metadata,
    ...structuredClone(overrides),
  };
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
    metadata[CHILD_SESSION_PROMOTED_METADATA_KEY] = false;
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
    metadataOverrides?: Record<string, unknown>;
    agentId?: string;
    model?: string;
    runtime?: string;
    thinkingLevel?: string;
    sessionType?: string;
    projectRoot?: string | null;
    parentSessionId?: string;
    requestId?: string;
  }): SessionRecord => {
    const {
      agentId,
      metadataOverrides,
      model,
      parentSessionId: rawParentSessionId,
      projectRoot,
      requestId: rawRequestId,
      runtime,
      sessionType: requestedSessionType,
      sourceSessionMetadata,
      task,
      thinkingLevel,
      title: requestedTitle,
    } = params;
    const sessionId = buildSessionId();
    const now = new Date().toISOString();
    const session = this.sessionManager.getOrCreate(sessionId);
    const resolvedAgentId = resolveSessionAgentId({
      agentId,
      getConfig: this.getConfig,
    });
    const title = resolveSessionTitle({
      title: requestedTitle,
      task,
    });
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

    session.agentId = resolvedAgentId;
    session.metadata = nextMetadata;
    session.updatedAt = new Date(now);
    this.sessionManager.save(session);
    this.onSessionUpdated?.(sessionId);

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

  createChildSession = (params: {
    parentSessionId: string;
    task: string;
    title?: string;
    sourceSessionMetadata: Record<string, unknown>;
    metadataOverrides?: Record<string, unknown>;
    agentId?: string;
    model?: string;
    runtime?: string;
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
