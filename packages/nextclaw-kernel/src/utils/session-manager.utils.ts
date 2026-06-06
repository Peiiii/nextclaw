import type { NcpEndpointEvent } from "@nextclaw/ncp";

export function normalizeSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function applyLimit<T>(items: T[], limit?: number): T[] {
  if (!Number.isFinite(limit) || typeof limit !== "number" || limit <= 0) {
    return items;
  }
  return items.slice(0, Math.trunc(limit));
}

export function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readOptionalMetadataString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

export function readEventSessionId(event: NcpEndpointEvent): string | undefined {
  return "payload" in event && "sessionId" in event.payload
    ? readOptionalMetadataString(event.payload.sessionId)
    : undefined;
}
