import type { ThinkingEffort } from "@kernel/types/agent-run.types.js";
import {
  readOptionalMetadataString,
  readOptionalString,
} from "@kernel/utils/session-manager.utils.js";

export const DEFAULT_SESSION_TYPE = "native";
export const DEFAULT_SESSION_LIFECYCLE = "persistent";

const SESSION_METADATA_LABEL_KEY = "label";
const CHILD_SESSION_PARENT_METADATA_KEY = "parent_session_id";
const CHILD_SESSION_REQUEST_METADATA_KEY = "spawned_by_request_id";
const CHILD_SESSION_LIFECYCLE_METADATA_KEY = "session_lifecycle";

export function readThinkingEffort(metadata: Record<string, unknown> | undefined): ThinkingEffort | null {
  return (
    readOptionalMetadataString(metadata?.thinkingEffort) ??
    readOptionalMetadataString(metadata?.preferred_thinking) ??
    readOptionalMetadataString(metadata?.thinking) ??
    null
  );
}

export function readProjectRoot(metadata: Record<string, unknown> | undefined): string | undefined {
  return readOptionalMetadataString(metadata?.project_root) ?? readOptionalMetadataString(metadata?.projectRoot);
}

export function readAgentRuntimeId(metadata: Record<string, unknown> | undefined): string | undefined {
  return (
    readOptionalMetadataString(metadata?.agentRuntimeId) ??
    readOptionalMetadataString(metadata?.runtime) ??
    readOptionalMetadataString(metadata?.session_type)
  );
}

export function summarizeTask(task: string): string {
  const normalized = task.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "Session";
  }
  return normalized.length <= 72 ? normalized : `${normalized.slice(0, 69)}...`;
}

export function cloneInheritedMetadata(sourceMetadata: Record<string, unknown>): Record<string, unknown> {
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

export function mergeMetadataOverrides(
  metadata: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return overrides && Object.keys(overrides).length > 0
    ? { ...metadata, ...structuredClone(overrides) }
    : metadata;
}

export function resolveSessionType(params: {
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

export function applySessionOverrides(params: {
  lifecycle: string;
  metadata: Record<string, unknown>;
  model?: string;
  parentSessionId?: string;
  projectRoot?: string | null;
  requestId?: string;
  sessionType: string;
  thinkingLevel?: string;
  title?: string;
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
