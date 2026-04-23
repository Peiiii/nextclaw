import type { InboundAttachment, SessionMessage } from "@nextclaw/core";
import { buildNcpUserContent, type LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import {
  type NcpMessage,
  type NcpMessagePart,
  type NcpToolInvocationPart,
  sanitizeAssistantReplyTags,
} from "@nextclaw/ncp";

export function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cloneMetadata(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? structuredClone(value) : undefined;
}

export function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const deduped = new Set<string>();
  for (const item of value) {
    const normalized = normalizeString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped];
}

export function mergeSessionMetadata(
  currentMetadata: Record<string, unknown>,
  inputMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  if (!inputMetadata) {
    return currentMetadata;
  }

  const nextMetadata = {
    ...currentMetadata,
    ...structuredClone(inputMetadata),
  };
  const model =
    normalizeString(inputMetadata.model) ??
    normalizeString(inputMetadata.preferred_model) ??
    normalizeString(inputMetadata.preferredModel);
  if (model) {
    nextMetadata.model = model;
    nextMetadata.preferred_model = model;
  }

  const thinking =
    normalizeString(inputMetadata.thinking) ??
    normalizeString(inputMetadata.preferred_thinking) ??
    normalizeString(inputMetadata.thinking_level) ??
    normalizeString(inputMetadata.thinkingLevel);
  if (thinking) {
    nextMetadata.thinking = thinking;
    nextMetadata.preferred_thinking = thinking;
  }

  const sessionType =
    normalizeString(inputMetadata.session_type) ?? normalizeString(inputMetadata.sessionType);
  if (sessionType) {
    nextMetadata.session_type = sessionType;
  }

  const label =
    normalizeString(inputMetadata.label) ?? normalizeString(inputMetadata.session_label);
  if (label) {
    nextMetadata.label = label;
  }

  const requestedSkills =
    readStringArray(inputMetadata.requested_skills) ??
    readStringArray(inputMetadata.requestedSkills);
  if (requestedSkills) {
    nextMetadata.requested_skills = requestedSkills;
  }

  return nextMetadata;
}

export function extractMessageMetadata(messages: NcpMessage[]): Record<string, unknown> | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const metadata = cloneMetadata(message.metadata);
    if (metadata) {
      return metadata;
    }
  }
  return undefined;
}

export function ensureIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return fallback;
  }
  return new Date(timestamp).toISOString();
}

function serializeToolArgs(args: unknown): string {
  if (typeof args === "string") {
    return args;
  }
  return JSON.stringify(args ?? {});
}

function serializeLegacyContent(parts: NcpMessagePart[]): unknown {
  const text = parts
    .filter(isTextLikePart)
    .map((part) => part.text)
    .join("");
  if (text.length > 0) {
    return text;
  }
  if (parts.length === 0) {
    return "";
  }
  return structuredClone(parts);
}

export function extractTextFromNcpMessage(message: NcpMessage | undefined): string {
  if (!message) {
    return "";
  }
  const normalizedMessage = message.role === "assistant" ? sanitizeAssistantReplyTags(message) : message;
  return normalizedMessage.parts
    .filter(isTextLikePart)
    .map((part) => part.text)
    .join("");
}

function isTextLikePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

function guessImageMime(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) {
    return null;
  }
  const normalized = pathOrUrl.trim().toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".bmp")) return "image/bmp";
  if (normalized.endsWith(".tif") || normalized.endsWith(".tiff")) return "image/tiff";
  return null;
}

function isRenderableImageFilePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "file" }> {
  if (part.type !== "file") {
    return false;
  }
  const mimeType = normalizeString(part.mimeType);
  if (mimeType?.startsWith("image/")) {
    return true;
  }
  return Boolean(guessImageMime(normalizeString(part.url) ?? normalizeString(part.name)));
}

function resolveImageUrl(part: Extract<NcpMessagePart, { type: "file" }>): string | null {
  const url = normalizeString(part.url);
  if (url) {
    return url;
  }
  const mimeType = normalizeString(part.mimeType);
  const contentBase64 = normalizeString(part.contentBase64);
  if (!mimeType || !contentBase64) {
    return null;
  }
  return `data:${mimeType};base64,${contentBase64}`;
}

type LegacyContentBuildOptions = {
  assetStore?: LocalAssetStore | null;
};

export function buildLegacyUserContent(
  parts: NcpMessagePart[],
  options: LegacyContentBuildOptions = {},
): unknown {
  const content = buildNcpUserContent(parts, {
    assetStore: options.assetStore,
  });
  if (content === "") {
    return serializeLegacyContent(parts);
  }
  return content;
}

export function extractAttachmentsFromNcpMessage(message: NcpMessage | undefined): InboundAttachment[] {
  if (!message) {
    return [];
  }

  const attachments: InboundAttachment[] = [];
  for (const part of message.parts) {
    if (!isRenderableImageFilePart(part)) {
      continue;
    }
    const imageUrl = resolveImageUrl(part);
    if (!imageUrl) {
      continue;
    }
    attachments.push({
      name: normalizeString(part.name) ?? undefined,
      url: imageUrl,
      mimeType: normalizeString(part.mimeType) ?? guessImageMime(normalizeString(part.url) ?? normalizeString(part.name)) ?? undefined,
      size: typeof part.sizeBytes === "number" ? part.sizeBytes : undefined,
      source: "ncp",
      status: "remote-only",
    });
  }
  return attachments;
}

function buildLegacyAssistantMessages(message: NcpMessage, timestamp: string): SessionMessage[] {
  const textContent = extractTextFromNcpMessage(message);
  const reasoningContent = message.parts
    .filter((part): part is Extract<NcpMessagePart, { type: "reasoning" }> => part.type === "reasoning")
    .map((part) => part.text)
    .join("");
  const toolInvocations = message.parts.filter(
    (part): part is NcpToolInvocationPart => part.type === "tool-invocation"
  );

  const assistantMessage: SessionMessage = {
    role: "assistant",
    content: textContent,
    timestamp,
    ncp_message_id: message.id,
    ncp_parts: structuredClone(message.parts),
  };
  if (typeof message.metadata?.reply_to === "string" && message.metadata.reply_to.trim().length > 0) {
    assistantMessage.reply_to = message.metadata.reply_to.trim();
  }
  if (reasoningContent.length > 0) {
    assistantMessage.reasoning_content = reasoningContent;
  }
  if (toolInvocations.length > 0) {
    assistantMessage.tool_calls = toolInvocations.map((toolInvocation, index) => ({
      id: toolInvocation.toolCallId ?? `${message.id}:tool:${index}`,
      type: "function",
      function: {
        name: toolInvocation.toolName,
        arguments: serializeToolArgs(toolInvocation.args),
      },
    }));
  }

  const messages: SessionMessage[] = [assistantMessage];
  for (const toolInvocation of toolInvocations) {
    if (toolInvocation.state !== "result") {
      continue;
    }
    messages.push({
      role: "tool",
      name: toolInvocation.toolName,
      tool_call_id: toolInvocation.toolCallId,
      content:
        typeof toolInvocation.result === "string"
          ? toolInvocation.result
          : JSON.stringify(toolInvocation.result ?? null),
      ...(toolInvocation.resultContentItems
        ? { ncp_tool_result_content_items: structuredClone(toolInvocation.resultContentItems) }
        : {}),
      timestamp,
      ncp_message_id: message.id,
    });
  }
  return messages;
}

function buildLegacyNonAssistantMessage(
  message: NcpMessage,
  timestamp: string,
  options: LegacyContentBuildOptions,
): SessionMessage {
  const role = message.role === "service" ? "system" : message.role;
  return {
    role,
    content: buildLegacyUserContent(message.parts, options),
    timestamp,
    ncp_message_id: message.id,
    ncp_parts: structuredClone(message.parts),
  };
}

export function toLegacyMessages(
  messages: NcpMessage[],
  options: LegacyContentBuildOptions = {},
): SessionMessage[] {
  const legacyMessages: SessionMessage[] = [];

  for (const rawMessage of messages) {
    const message = rawMessage.role === "assistant" ? sanitizeAssistantReplyTags(rawMessage) : rawMessage;
    const timestamp = ensureIsoTimestamp(message.timestamp, new Date().toISOString());

    if (message.role === "assistant") {
      legacyMessages.push(...buildLegacyAssistantMessages(message, timestamp));
      continue;
    }

    legacyMessages.push(buildLegacyNonAssistantMessage(message, timestamp, options));
  }

  return legacyMessages;
}
