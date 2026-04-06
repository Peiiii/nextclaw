import type { SessionMessage } from "@nextclaw/core";
import { type NcpMessage, type NcpMessagePart, sanitizeAssistantReplyTags } from "@nextclaw/ncp";
import {
  ensureIsoTimestamp,
  normalizeString,
} from "./nextclaw-ncp-message-bridge.js";

type LegacyToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toTextPart(text: string): NcpMessagePart | null {
  return text.length > 0 ? { type: "text", text } : null;
}

function contentToParts(content: unknown): NcpMessagePart[] {
  if (typeof content === "string") {
    const textPart = toTextPart(content);
    return textPart ? [textPart] : [];
  }
  if (Array.isArray(content)) {
    return content.length > 0
      ? [
          {
            type: "extension",
            extensionType: "nextclaw.legacy.content-array",
            data: structuredClone(content)
          }
        ]
      : [];
  }
  if (content && typeof content === "object") {
    return [
      {
        type: "extension",
        extensionType: "nextclaw.legacy.content-object",
        data: structuredClone(content)
      }
    ];
  }
  return [];
}

function normalizeToolResultPayload(value: unknown): unknown {
  if (typeof value !== "string") {
    return structuredClone(value);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  return tryParseJson(trimmed);
}

function parseLegacyToolCalls(value: unknown): LegacyToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const toolCall = entry as Record<string, unknown>;
      const id = normalizeString(toolCall.id);
      const rawFunction = toolCall.function;
      if (!id || !rawFunction || typeof rawFunction !== "object" || Array.isArray(rawFunction)) {
        return null;
      }
      const fn = rawFunction as Record<string, unknown>;
      const name = normalizeString(fn.name);
      const args = typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {});
      if (!name) {
        return null;
      }
      return {
        id,
        type: "function" as const,
        function: {
          name,
          arguments: args
        }
      };
    })
    .filter((entry): entry is LegacyToolCall => entry !== null);
}

function createMessageId(sessionId: string, index: number, role: string, timestamp: string): string {
  return `${sessionId}:${role.trim().toLowerCase() || "message"}:${index}:${timestamp}`;
}

function isNcpMessagePart(value: unknown): value is NcpMessagePart {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof (value as { type?: unknown }).type === "string";
}

function readStoredNcpParts(message: SessionMessage): NcpMessagePart[] | null {
  const rawParts = message.ncp_parts;
  if (!Array.isArray(rawParts)) {
    return null;
  }
  const parts = rawParts.filter((part): part is NcpMessagePart => isNcpMessagePart(part));
  if (parts.length !== rawParts.length) {
    return null;
  }
  return structuredClone(parts);
}

function buildAssistantMessage(params: { sessionId: string; index: number; message: SessionMessage }): NcpMessage {
  const timestamp = ensureIsoTimestamp(params.message.timestamp, new Date().toISOString());
  const replyTo =
    typeof params.message.reply_to === "string" && params.message.reply_to.trim().length > 0
      ? params.message.reply_to.trim()
      : undefined;
  const storedParts = readStoredNcpParts(params.message);
  if (storedParts) {
    return sanitizeAssistantReplyTags({
      id: createMessageId(params.sessionId, params.index, "assistant", timestamp),
      sessionId: params.sessionId,
      role: "assistant",
      status: "final",
      timestamp,
      parts: storedParts,
      metadata: replyTo ? { reply_to: replyTo } : undefined,
    });
  }

  const toolCalls = parseLegacyToolCalls(params.message.tool_calls);
  const parts: NcpMessagePart[] = [...contentToParts(params.message.content)];
  const reasoning = normalizeString(params.message.reasoning_content);
  if (reasoning) {
    parts.push({
      type: "reasoning",
      text: reasoning
    });
  }

  for (const toolCall of toolCalls) {
    parts.push({
      type: "tool-invocation",
      toolCallId: toolCall.id,
      toolName: toolCall.function.name,
      state: "call",
      args: tryParseJson(toolCall.function.arguments)
    });
  }

  return sanitizeAssistantReplyTags({
    id: createMessageId(params.sessionId, params.index, "assistant", timestamp),
    sessionId: params.sessionId,
    role: "assistant",
    status: "final",
    timestamp,
    parts,
    metadata: replyTo ? { reply_to: replyTo } : undefined,
  });
}

function buildGenericMessage(
  params: { sessionId: string; index: number; role: NcpMessage["role"]; message: SessionMessage },
): NcpMessage {
  const timestamp = ensureIsoTimestamp(params.message.timestamp, new Date().toISOString());
  const storedParts = readStoredNcpParts(params.message);
  if (storedParts) {
    return {
      id: createMessageId(params.sessionId, params.index, params.role, timestamp),
      sessionId: params.sessionId,
      role: params.role,
      status: "final",
      timestamp,
      parts: storedParts,
    };
  }
  return {
    id: createMessageId(params.sessionId, params.index, params.role, timestamp),
    sessionId: params.sessionId,
    role: params.role,
    status: "final",
    timestamp,
    parts: contentToParts(params.message.content)
  };
}

function attachToolResult(target: NcpMessage, toolCallId: string, result: unknown, toolName?: string): void {
  const normalizedResult = normalizeToolResultPayload(result);
  target.parts = target.parts.map((part) => {
    if (part.type !== "tool-invocation" || part.toolCallId !== toolCallId) {
      return part;
    }
    const alreadyHasResolvedResult =
      part.state === "result" && Object.prototype.hasOwnProperty.call(part, "result");
    if (alreadyHasResolvedResult) {
      return {
        ...part,
        ...(toolName ? { toolName } : {}),
      };
    }
    return {
      ...part,
      toolName: toolName ?? part.toolName,
      state: "result",
      result: normalizedResult
    };
  });
}

export function toNcpMessages(sessionId: string, messages: SessionMessage[]): NcpMessage[] {
  const ncpMessages: NcpMessage[] = [];
  const assistantIndexByToolCallId = new Map<string, number>();

  messages.forEach((message, index) => {
    const role = normalizeString(message.role)?.toLowerCase() ?? "assistant";
    if (role === "tool") {
      const toolCallId = normalizeString(message.tool_call_id);
      if (toolCallId) {
        const assistantIndex = assistantIndexByToolCallId.get(toolCallId);
        if (assistantIndex !== undefined) {
          attachToolResult(
            ncpMessages[assistantIndex] as NcpMessage,
            toolCallId,
            structuredClone(message.content),
            normalizeString(message.name) ?? undefined
          );
          return;
        }
      }
      ncpMessages.push(
        buildGenericMessage({
          sessionId,
          index,
          role: "tool",
          message
        })
      );
      return;
    }

    if (role === "assistant") {
      const assistant = buildAssistantMessage({ sessionId, index, message });
      const assistantPosition = ncpMessages.push(assistant) - 1;
      for (const part of assistant.parts) {
        if (part.type === "tool-invocation" && part.toolCallId) {
          assistantIndexByToolCallId.set(part.toolCallId, assistantPosition);
        }
      }
      return;
    }

    const normalizedRole = (role === "system" || role === "user" || role === "service" ? role : "user") as NcpMessage["role"];
    ncpMessages.push(
      buildGenericMessage({
        sessionId,
        index,
        role: normalizedRole,
        message
      })
    );
  });

  return ncpMessages;
}

export function resolveLegacyEventType(message: SessionMessage): string {
  const role = normalizeString(message.role)?.toLowerCase() ?? "";
  if (role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return "assistant.tool_call";
  }
  if (role === "tool") {
    return "tool.result";
  }
  if (role === "assistant") {
    return "message.assistant";
  }
  if (role === "user") {
    return "message.user";
  }
  if (role === "system") {
    return "message.system";
  }
  return `message.${role || "other"}`;
}
