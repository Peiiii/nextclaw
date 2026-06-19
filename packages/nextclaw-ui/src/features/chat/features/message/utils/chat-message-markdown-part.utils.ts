import {
  resolveInlineTokensForText,
  type ChatInlineTokenSource,
} from "@/features/chat/features/input/utils/chat-inline-token.utils";
import type { ChatMessagePartViewModel } from "@nextclaw/agent-chat-ui";
import type { ChatMessagePartSource } from "./chat-message-part.utils";

const INVISIBLE_ONLY_TEXT_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;

function toRenderableText(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const visible = trimmed.replace(INVISIBLE_ONLY_TEXT_PATTERN, "").trim();
  return visible ? trimmed : null;
}

export function buildTextPart(
  part: Extract<ChatMessagePartSource, { type: "text" }>,
  inlineTokens: readonly ChatInlineTokenSource[],
): Extract<ChatMessagePartViewModel, { type: "markdown" }> | null {
  const text = toRenderableText(part.text);
  if (!text) {
    return null;
  }
  const resolvedInlineTokens = resolveInlineTokensForText(part.text, inlineTokens);
  return {
    type: "markdown",
    text,
    inlineTokens:
      resolvedInlineTokens.length > 0 ? resolvedInlineTokens : undefined,
  };
}

export function buildRenderableText(value: string): string | null {
  return toRenderableText(value);
}
