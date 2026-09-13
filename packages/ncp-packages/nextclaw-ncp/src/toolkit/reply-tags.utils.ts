import type { NcpMessage } from "../types/message.js";

export type NcpReplyTagParseResult = {
  content: string;
  replyTo?: string;
};

const REPLY_TO_CURRENT_PATTERN = /^\s*\[\[\s*reply_to_current\s*\]\]/i;
const REPLY_TO_ID_PATTERN = /^\s*\[\[\s*reply_to\s*:\s*([^\]]+?)\s*\]\]/i;

function normalizeReplyTarget(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function stripReplyTagsFromText(content: string, currentMessageId?: string): NcpReplyTagParseResult {
  let nextContent = content;
  let replyTo: string | undefined;

  if (REPLY_TO_CURRENT_PATTERN.test(nextContent)) {
    replyTo = normalizeReplyTarget(currentMessageId);
    nextContent = nextContent.replace(REPLY_TO_CURRENT_PATTERN, "").trim();
  }

  const explicitReplyTarget = nextContent.match(REPLY_TO_ID_PATTERN)?.[1];
  if (explicitReplyTarget) {
    replyTo = normalizeReplyTarget(explicitReplyTarget);
    nextContent = nextContent.replace(REPLY_TO_ID_PATTERN, "").trim();
  }

  return replyTo ? { content: nextContent, replyTo } : { content: nextContent };
}

export function sanitizeAssistantReplyTags(
  message: NcpMessage,
  currentMessageId?: string,
): NcpMessage {
  if (message.role !== "assistant") {
    return {
      ...message,
      parts: [...message.parts],
      metadata: message.metadata ? { ...message.metadata } : undefined,
    };
  }

  const firstTextIndex = message.parts.findIndex((part) => part.type === "text");
  const nextMetadata = message.metadata ? { ...message.metadata } : undefined;
  const existingReplyTo = normalizeReplyTarget(nextMetadata?.reply_to);

  if (firstTextIndex < 0) {
    return {
      ...message,
      parts: [...message.parts],
      metadata: nextMetadata,
    };
  }

  const firstTextPart = message.parts[firstTextIndex];
  if (!firstTextPart || firstTextPart.type !== "text") {
    return {
      ...message,
      parts: [...message.parts],
      metadata: nextMetadata,
    };
  }

  const { content, replyTo } = stripReplyTagsFromText(firstTextPart.text, currentMessageId);
  const effectiveReplyTo = replyTo ?? existingReplyTo;
  const nextParts = message.parts.flatMap((part, index) => {
    if (index !== firstTextIndex || part.type !== "text") {
      return [part];
    }
    if (content.length === 0) {
      return [];
    }
    return [{ ...part, text: content }];
  });

  if (effectiveReplyTo) {
    return {
      ...message,
      parts: nextParts,
      metadata: {
        ...nextMetadata,
        reply_to: effectiveReplyTo,
      },
    };
  }

  return {
    ...message,
    parts: nextParts,
    metadata: nextMetadata,
  };
}
