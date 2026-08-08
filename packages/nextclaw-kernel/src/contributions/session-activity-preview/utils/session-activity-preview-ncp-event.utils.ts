import {
  isHiddenNcpMessage,
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import type {
  SessionActivityPreviewMetadata,
  SessionActivityPreviewProjection,
} from "@kernel/contributions/session-activity-preview/types/session-activity-preview.types.js";

const PREVIEW_TEXT_MAX_LENGTH = 160;

type SessionActivityPreviewEventOptions = {
  readToolName?: (sessionId: string, toolCallId: string) => string | null;
};

function readSessionId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compactPreviewText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncatePreviewText(value: string): string {
  const compacted = compactPreviewText(value);
  if (compacted.length <= PREVIEW_TEXT_MAX_LENGTH) {
    return compacted;
  }
  return compacted.slice(0, PREVIEW_TEXT_MAX_LENGTH - 1).trimEnd();
}

export function readSessionActivityPreviewText(message: NcpMessage): string | null {
  const chunks: string[] = [];
  for (const part of message.parts) {
    if ((part.type === "text" || part.type === "rich-text") && part.text.trim()) {
      chunks.push(part.text);
    }
  }
  const previewText = truncatePreviewText(chunks.join(" "));
  return previewText.length > 0 ? previewText : null;
}

function createProjection(
  sessionId: string | null,
  preview: SessionActivityPreviewMetadata,
): SessionActivityPreviewProjection | null {
  if (!sessionId) {
    return null;
  }
  return { sessionId, preview };
}

function readErrorDetail(error: unknown): string | undefined {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return undefined;
}

function readToolCallId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createSessionActivityPreviewFromNcpEvent(
  event: NcpEndpointEvent,
  timestamp: string,
  options: SessionActivityPreviewEventOptions = {},
): SessionActivityPreviewProjection | null {
  switch (event.type) {
    case NcpEventType.RunStarted:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusKind: "thinking",
        timestamp,
      });
    case NcpEventType.RunFinished:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "completed",
        timestamp,
      });
    case NcpEventType.RunError:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "failed",
        statusKind: event.payload.interrupted ? "run-interrupted" : "run-failed",
        statusText: readErrorDetail(event.payload.error),
        timestamp,
      });
    case NcpEventType.MessageSent: {
      if (isHiddenNcpMessage(event.payload.message)) {
        return null;
      }
      const text = readSessionActivityPreviewText(event.payload.message);
      if (!text || event.payload.message.role !== "user") {
        return null;
      }
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusText: text,
        timestamp: event.payload.message.timestamp || timestamp,
      });
    }
    case NcpEventType.MessageCompleted: {
      const text = readSessionActivityPreviewText(event.payload.message);
      if (!text || event.payload.message.role !== "assistant") {
        return null;
      }
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "completed",
        replyText: text,
        timestamp,
      });
    }
    case NcpEventType.MessageFailed:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "failed",
        statusKind: "run-failed",
        statusText: readErrorDetail(event.payload.error),
        timestamp,
      });
    case NcpEventType.MessageAbort:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "cancelled",
        timestamp,
      });
    case NcpEventType.MessageToolCallStart:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusKind: "tool-running",
        statusText: event.payload.toolName,
        timestamp,
      });
    case NcpEventType.MessageToolCallEnd:
    case NcpEventType.MessageToolCallResult: {
      const sessionId = readSessionId(event.payload.sessionId);
      const toolCallId = readToolCallId(event.payload.toolCallId);
      return createProjection(sessionId, {
        state: "running",
        statusKind: "tool-completed",
        statusText: sessionId && toolCallId
          ? options.readToolName?.(sessionId, toolCallId) ?? undefined
          : undefined,
        timestamp,
      });
    }
    default:
      return null;
  }
}
