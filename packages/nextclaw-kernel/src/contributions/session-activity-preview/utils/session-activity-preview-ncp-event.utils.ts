import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import type {
  SessionActivityPreviewMetadata,
  SessionActivityPreviewProjection,
} from "@kernel/contributions/session-activity-preview/types/session-activity-preview.types.js";

const PREVIEW_TEXT_MAX_LENGTH = 160;

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

function readMessagePreviewText(message: NcpMessage): string | null {
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

function formatErrorStatus(error: unknown): string {
  if (typeof error === "string" && error.trim()) {
    return `运行出错：${truncatePreviewText(error)}`;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return `运行出错：${truncatePreviewText(message)}`;
    }
  }
  return "运行出错";
}

export function createSessionActivityPreviewFromNcpEvent(
  event: NcpEndpointEvent,
  timestamp: string,
): SessionActivityPreviewProjection | null {
  switch (event.type) {
    case NcpEventType.RunStarted:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusText: "正在处理...",
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
        statusText: formatErrorStatus(event.payload.error),
        timestamp,
      });
    case NcpEventType.MessageSent: {
      const text = readMessagePreviewText(event.payload.message);
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
      const text = readMessagePreviewText(event.payload.message);
      if (!text || event.payload.message.role !== "assistant") {
        return null;
      }
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "completed",
        replyText: text,
        timestamp: event.payload.message.timestamp || timestamp,
      });
    }
    case NcpEventType.MessageFailed:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "failed",
        statusText: formatErrorStatus(event.payload.error),
        timestamp,
      });
    case NcpEventType.MessageToolCallStart:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusText: `正在调用工具：${event.payload.toolName}`,
        timestamp,
      });
    case NcpEventType.MessageToolCallEnd:
    case NcpEventType.MessageToolCallResult:
      return createProjection(readSessionId(event.payload.sessionId), {
        state: "running",
        statusText: "工具调用完成",
        timestamp,
      });
    default:
      return null;
  }
}
