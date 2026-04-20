import {
  splitTextByInlineTokens,
  type ChatInlineTokenSource,
} from "@/features/chat/utils/chat-inline-token.utils";
import type {
  ChatInlineContentSegmentViewModel,
  ChatMessagePartViewModel,
} from "@nextclaw/agent-chat-ui";
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

function hasVisibleText(value: string): boolean {
  return value.replace(INVISIBLE_ONLY_TEXT_PATTERN, "").trim().length > 0;
}

function buildInlineContentSegments(
  text: string,
  inlineTokens: readonly ChatInlineTokenSource[],
): ChatInlineContentSegmentViewModel[] | null {
  const fragments = splitTextByInlineTokens(text, inlineTokens);
  if (fragments.length === 0) {
    return null;
  }

  const segments: ChatInlineContentSegmentViewModel[] = [];
  let hasVisibleContent = false;

  for (const fragment of fragments) {
    if (fragment.type === "token") {
      hasVisibleContent = true;
      segments.push({
        type: "token",
        token: {
          kind: fragment.token.kind,
          key: fragment.token.key,
          label: fragment.token.label,
          rawText: fragment.token.rawText,
        },
      });
      continue;
    }

    if (fragment.text.length === 0) {
      continue;
    }
    if (hasVisibleText(fragment.text)) {
      hasVisibleContent = true;
    }
    segments.push({
      type: "markdown",
      text: fragment.text,
    });
  }

  return hasVisibleContent ? segments : null;
}

export function buildTextPart(
  part: Extract<ChatMessagePartSource, { type: "text" }>,
  inlineTokens: readonly ChatInlineTokenSource[],
): Extract<
  ChatMessagePartViewModel,
  { type: "markdown" | "inline-content" }
> | null {
  const inlineContent = buildInlineContentSegments(part.text, inlineTokens);
  if (inlineContent && inlineContent.some((segment) => segment.type === "token")) {
    return {
      type: "inline-content",
      segments: inlineContent,
    };
  }

  const text = toRenderableText(part.text);
  if (!text) {
    return null;
  }
  return {
    type: "markdown",
    text,
  };
}

export function buildRenderableText(value: string): string | null {
  return toRenderableText(value);
}
