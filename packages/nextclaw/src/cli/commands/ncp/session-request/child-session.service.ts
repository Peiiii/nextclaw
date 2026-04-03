import type { SessionManager } from "@nextclaw/core";
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
    return "Child session";
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

function buildChildSessionId(agentId?: string): string {
  void agentId;
  return `ncp-${Date.now().toString(36)}-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export class ChildSessionService {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly onSessionUpdated?: (sessionKey: string) => void,
  ) {}

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
    const sessionId = buildChildSessionId(params.agentId);
    const now = new Date().toISOString();
    const session = this.sessionManager.getOrCreate(sessionId);
    const title = readOptionalString(params.title) ?? summarizeTask(params.task);
    const metadata = cloneInheritedMetadata(params.sourceSessionMetadata);
    const sessionType =
      readOptionalString(params.sessionType) ??
      readOptionalString(metadata.session_type) ??
      DEFAULT_SESSION_TYPE;

    metadata.session_type = sessionType;
    metadata[SESSION_METADATA_LABEL_KEY] = title;
    metadata[CHILD_SESSION_PARENT_METADATA_KEY] = params.parentSessionId;
    metadata[CHILD_SESSION_LIFECYCLE_METADATA_KEY] = DEFAULT_LIFECYCLE;
    metadata[CHILD_SESSION_PROMOTED_METADATA_KEY] = false;
    if (params.requestId) {
      metadata[CHILD_SESSION_REQUEST_METADATA_KEY] = params.requestId;
    }
    if (readOptionalString(params.model)) {
      metadata.model = params.model?.trim();
      metadata.preferred_model = params.model?.trim();
    }
    if (readOptionalString(params.thinkingLevel)) {
      metadata.thinking = params.thinkingLevel?.trim();
      metadata.preferred_thinking = params.thinkingLevel?.trim();
    }
    if (readOptionalString(params.projectRoot)) {
      metadata.project_root = params.projectRoot?.trim();
    }

    session.metadata = metadata;
    session.updatedAt = new Date(now);
    this.sessionManager.save(session);
    this.onSessionUpdated?.(sessionId);

    return {
      sessionId,
      sessionType,
      runtimeFamily: "native",
      parentSessionId: params.parentSessionId,
      spawnedByRequestId: params.requestId,
      lifecycle: DEFAULT_LIFECYCLE,
      title,
      metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
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
