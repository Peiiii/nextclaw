import {
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";

export function readContextWindowEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId.trim() || null
    : null;
}

export function isContextWindowSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createContextWindowSignature(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

export function shouldRefreshContextWindowDuringStream(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageTextStart:
    case NcpEventType.MessageTextDelta:
    case NcpEventType.MessageTextEnd:
    case NcpEventType.MessageReasoningStart:
    case NcpEventType.MessageReasoningDelta:
    case NcpEventType.MessageReasoningEnd:
    case NcpEventType.MessageToolCallStart:
    case NcpEventType.MessageToolCallArgs:
    case NcpEventType.MessageToolCallArgsDelta:
    case NcpEventType.MessageToolCallEnd:
    case NcpEventType.MessageToolCallResult:
      return true;
    default:
      return false;
  }
}

export function shouldRefreshContextWindowImmediately(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageSent:
    case NcpEventType.MessageCompleted:
    case NcpEventType.MessageFailed:
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}
