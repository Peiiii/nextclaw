import type { RemoteDisconnectObservation } from "../types/remote.types.js";

const TERMINAL_REMOTE_ERROR_PATTERNS = [
  /invalid or expired token/i,
  /missing bearer token/i,
  /token expired/i,
  /token is invalid/i,
  /run "nextclaw login"/i,
  /replaced by a newer connector session/i,
  /already owned by (?:running )?nextclaw service/i,
  /already owned by local nextclaw process/i,
  /unexpected server response:\s*400/i,
  /unexpected server response:\s*401/i,
  /unexpected server response:\s*403/i,
  /unexpected server response:\s*404/i,
  /invalid url/i,
  /unsupported protocol/i
];

export function isTerminalRemoteConnectorError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TERMINAL_REMOTE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function describeUnexpectedRemoteConnectorClose(event: {
  code?: unknown;
  reason?: unknown;
  wasClean?: unknown;
}): string | null {
  const code = typeof event.code === "number" && Number.isFinite(event.code) ? event.code : null;
  const reason = typeof event.reason === "string" ? event.reason.trim() : "";
  const wasClean = typeof event.wasClean === "boolean" ? event.wasClean : null;

  if ((code === null || code === 1000) && !reason) {
    return null;
  }

  const detailParts: string[] = [];
  if (code !== null) {
    detailParts.push(`code ${code}`);
  }
  if (wasClean !== null) {
    detailParts.push(wasClean ? "clean" : "unclean");
  }

  const detail = detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";
  if (reason) {
    return `Remote connector websocket closed${detail}: ${reason}`;
  }
  return `Remote connector websocket closed${detail}.`;
}

export class RemoteConnectorDisconnectError extends Error {
  constructor(
    message: string,
    readonly observation: RemoteDisconnectObservation,
  ) {
    super(message);
    this.name = "RemoteConnectorDisconnectError";
  }
}

export function createRemoteConnectorCloseError(params: {
  event: {
    code?: unknown;
    reason?: unknown;
    wasClean?: unknown;
  };
  connectionId: string;
  connectedAt: string | null;
  now?: Date;
}): RemoteConnectorDisconnectError | null {
  const { connectedAt, connectionId, event } = params;
  const message = describeUnexpectedRemoteConnectorClose(event);
  if (!message) {
    return null;
  }
  const now = params.now ?? new Date();
  const code =
    typeof event.code === "number" && Number.isFinite(event.code)
      ? event.code
      : null;
  const reason =
    typeof event.reason === "string" && event.reason.trim()
      ? event.reason.trim()
      : null;
  const wasClean =
    typeof event.wasClean === "boolean" ? event.wasClean : null;
  const connectedAtMs = connectedAt
    ? Date.parse(connectedAt)
    : Number.NaN;
  return new RemoteConnectorDisconnectError(message, {
    source: "close",
    connectionId,
    at: now.toISOString(),
    code,
    reason,
    wasClean,
    connectedDurationMs: Number.isFinite(connectedAtMs)
      ? Math.max(0, now.getTime() - connectedAtMs)
      : null,
  });
}

export function createRemoteConnectorTransportError(params: {
  message: string;
  source: "socket_error" | "heartbeat_timeout";
  connectionId: string;
  connectedAt: string | null;
  now?: Date;
}): RemoteConnectorDisconnectError {
  const { connectedAt, connectionId, message, source } = params;
  const now = params.now ?? new Date();
  const connectedAtMs = connectedAt
    ? Date.parse(connectedAt)
    : Number.NaN;
  return new RemoteConnectorDisconnectError(message, {
    source,
    connectionId,
    at: now.toISOString(),
    code: null,
    reason: message,
    wasClean: false,
    connectedDurationMs: Number.isFinite(connectedAtMs)
      ? Math.max(0, now.getTime() - connectedAtMs)
      : null,
  });
}
