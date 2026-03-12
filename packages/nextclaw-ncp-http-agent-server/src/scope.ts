import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { EventScope } from "./types.js";

type ExtractedScope = {
  sessionId?: string;
  correlationId?: string;
  runId?: string;
};

export function extractScopeFromEvent(event: NcpEndpointEvent): ExtractedScope {
  const payload = readPayload(event);
  if (!payload) {
    return {};
  }
  const runId = readString(payload.runId) ?? readString(payload.remoteRunId);
  return {
    sessionId: readString(payload.sessionId),
    correlationId: readString(payload.correlationId),
    runId,
  };
}

export function matchesScope(scope: EventScope, event: NcpEndpointEvent): boolean {
  const eventScope = extractScopeFromEvent(event);

  if (eventScope.sessionId && eventScope.sessionId !== scope.sessionId) {
    return false;
  }
  if (scope.correlationId && eventScope.correlationId && eventScope.correlationId !== scope.correlationId) {
    return false;
  }
  if (scope.runId && eventScope.runId && eventScope.runId !== scope.runId) {
    return false;
  }
  return true;
}

export function isTerminalEvent(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case "message.completed":
    case "message.failed":
    case "run.finished":
    case "run.error":
    case "message.abort":
      return true;
    default:
      return false;
  }
}

function readPayload(event: NcpEndpointEvent): Record<string, unknown> | null {
  if (!("payload" in event)) {
    return null;
  }
  return isRecord(event.payload) ? event.payload : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
