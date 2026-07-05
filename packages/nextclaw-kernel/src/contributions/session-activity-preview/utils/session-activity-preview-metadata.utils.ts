import type {
  SessionActivityPreviewMetadata,
  SessionActivityPreviewProjection,
  SessionActivityPreviewState,
} from "@kernel/contributions/session-activity-preview/types/session-activity-preview.types.js";

export const SESSION_ACTIVITY_PREVIEW_METADATA_KEY = "last_activity_preview";

const SESSION_ACTIVITY_PREVIEW_STATES = new Set<SessionActivityPreviewState>([
  "running",
  "completed",
  "failed",
  "cancelled",
  "idle",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readSessionActivityPreviewMetadata(value: unknown): SessionActivityPreviewMetadata | null {
  if (!isRecord(value)) {
    return null;
  }
  const state = value.state;
  const timestamp = readOptionalString(value.timestamp);
  if (!SESSION_ACTIVITY_PREVIEW_STATES.has(state as SessionActivityPreviewState) || !timestamp) {
    return null;
  }
  return {
    state: state as SessionActivityPreviewState,
    timestamp,
    ...(readOptionalString(value.statusText) ? { statusText: readOptionalString(value.statusText) } : {}),
    ...(readOptionalString(value.replyText) ? { replyText: readOptionalString(value.replyText) } : {}),
  };
}

function compareIsoTimestamp(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return left.localeCompare(right);
  }
  return leftTime - rightTime;
}

function mergeSessionActivityPreview(
  current: SessionActivityPreviewMetadata | null,
  incoming: SessionActivityPreviewMetadata,
): SessionActivityPreviewMetadata {
  if (current && compareIsoTimestamp(incoming.timestamp, current.timestamp) < 0) {
    return incoming.replyText && !current.replyText ? { ...current, replyText: incoming.replyText } : current;
  }
  return {
    state: incoming.state,
    timestamp: incoming.timestamp,
    ...(incoming.statusText ?? (incoming.state === "completed" ? current?.statusText : undefined)
      ? { statusText: incoming.statusText ?? current?.statusText }
      : {}),
    ...(incoming.replyText ?? (incoming.state === "completed" ? current?.replyText : undefined)
      ? { replyText: incoming.replyText ?? current?.replyText }
      : {}),
  };
}

function areSessionActivityPreviewsEqual(
  left: SessionActivityPreviewMetadata | null,
  right: SessionActivityPreviewMetadata,
): boolean {
  return Boolean(left) &&
    left?.state === right.state &&
    left.timestamp === right.timestamp &&
    left.statusText === right.statusText &&
    left.replyText === right.replyText;
}

export function writeSessionActivityPreviewMetadata(
  metadata: Record<string, unknown> | undefined,
  projection: SessionActivityPreviewProjection,
): Record<string, unknown> | null {
  const current = readSessionActivityPreviewMetadata(metadata?.[SESSION_ACTIVITY_PREVIEW_METADATA_KEY]);
  const next = mergeSessionActivityPreview(current, projection.preview);
  if (areSessionActivityPreviewsEqual(current, next)) {
    return null;
  }
  return {
    ...(metadata ?? {}),
    [SESSION_ACTIVITY_PREVIEW_METADATA_KEY]: next,
  };
}
