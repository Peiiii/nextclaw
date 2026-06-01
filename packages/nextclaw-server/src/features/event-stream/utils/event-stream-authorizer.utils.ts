import type { AppEventEnvelope } from "@nextclaw/shared";
import type {
  EventStreamGrant,
  EventStreamPrincipal,
} from "@nextclaw-server/features/event-stream/types/event-stream-principal.types.js";

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasGrant(principal: EventStreamPrincipal, grant: EventStreamGrant): boolean {
  return principal.grants.includes(grant);
}

function scopeValues(principal: EventStreamPrincipal, key: string): string[] {
  const value = principal.scopes[key];
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function hasScopeValue(principal: EventStreamPrincipal, key: string, value: string | null): boolean {
  return Boolean(value && scopeValues(principal, key).includes(value));
}

function readExtensionRequestTarget(event: AppEventEnvelope): string | null {
  return readString(readRecord(event.payload).extensionId);
}

function parseAgentSessionChannel(sessionId: string | null): string | null {
  if (!sessionId) {
    return null;
  }
  const parts = sessionId.split(":");
  return parts[0] === "agent" && parts.length >= 5 ? readString(parts[2]) : null;
}

function readNcpEventChannel(event: AppEventEnvelope): string | null {
  const payload = readRecord(event.payload);
  const endpointPayload = readRecord(payload.payload);
  const message = readRecord(payload.message ?? endpointPayload.message);
  const metadata = readRecord(message.metadata ?? payload.metadata);
  return (
    readString(metadata.channelId) ??
    readString(metadata.channel) ??
    parseAgentSessionChannel(readString(message.sessionId) ?? readString(payload.sessionId))
  );
}

export function canStreamAppEventToPrincipal(
  principal: EventStreamPrincipal,
  event: AppEventEnvelope,
): boolean {
  if (event.type === "extension.request") {
    return hasGrant(principal, "event-stream:extension-requests") &&
      hasScopeValue(principal, "extensionIds", readExtensionRequestTarget(event));
  }

  if (event.type === "ncp.event") {
    if (hasGrant(principal, "event-stream:ui-events")) {
      return true;
    }
    return hasGrant(principal, "event-stream:ncp-events") &&
      hasScopeValue(principal, "channelIds", readNcpEventChannel(event));
  }

  if (event.type === "config.updated") {
    if (hasGrant(principal, "event-stream:ui-events")) {
      return true;
    }
    const path = readString(readRecord(event.payload).path);
    const channelId = path?.startsWith("channels.")
      ? path.slice("channels.".length).trim()
      : null;
    return hasGrant(principal, "event-stream:config-events") &&
      (path === "channels" || hasScopeValue(principal, "channelIds", channelId));
  }

  return hasGrant(principal, "event-stream:ui-events");
}
