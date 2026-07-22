import type { ChatInlineTokenViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";

const INLINE_TOKEN_KIND_ATTR = "data-chat-inline-token-kind";
const INLINE_TOKEN_KEY_ATTR = "data-chat-inline-token-key";
const INLINE_TOKEN_REF_ATTR = "data-chat-inline-token-ref";
const INLINE_TOKEN_NAME_ATTR = "data-chat-inline-token-name";
const INLINE_TOKEN_SOURCE_ATTR = "data-chat-inline-token-source";
const INLINE_TOKEN_PATH_ATTR = "data-chat-inline-token-path";
const INLINE_TOKEN_LABEL_ATTR = "data-chat-inline-token-label";
const INLINE_TOKEN_RAW_TEXT_ATTR = "data-chat-inline-token-raw-text";

export type ChatMarkdownNode = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: ChatMarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
    hChildren?: Array<{ type: "text"; value: string }>;
  };
};

function prepareInlineTokens(
  inlineTokens: readonly ChatInlineTokenViewModel[],
): ChatInlineTokenViewModel[] {
  return inlineTokens.filter((token) => token.rawText).sort(
    (left, right) => right.rawText.length - left.rawText.length,
  );
}

function createInlineTokenNode(token: ChatInlineTokenViewModel): ChatMarkdownNode {
  const hProperties: Record<string, string> = {
    [INLINE_TOKEN_KIND_ATTR]: token.kind,
    [INLINE_TOKEN_LABEL_ATTR]: token.label,
    [INLINE_TOKEN_RAW_TEXT_ATTR]: token.rawText,
  };
  if ("ref" in token) {
    hProperties[INLINE_TOKEN_REF_ATTR] = token.ref;
    hProperties[INLINE_TOKEN_NAME_ATTR] = token.name;
    if (token.source) {
      hProperties[INLINE_TOKEN_SOURCE_ATTR] = token.source;
    }
    if (token.path) {
      hProperties[INLINE_TOKEN_PATH_ATTR] = token.path;
    }
  } else {
    hProperties[INLINE_TOKEN_KEY_ATTR] = token.key;
  }
  return {
    type: "chatInlineToken",
    data: {
      hName: "span",
      hProperties,
      hChildren: [{ type: "text", value: token.label }],
    },
  };
}

function findNextInlineToken(
  value: string,
  cursor: number,
  tokens: readonly ChatInlineTokenViewModel[],
): { index: number; token: ChatInlineTokenViewModel } | null {
  let next: { index: number; token: ChatInlineTokenViewModel } | null = null;
  for (const token of tokens) {
    const index = value.indexOf(token.rawText, cursor);
    if (index < 0) {
      continue;
    }
    if (
      !next ||
      index < next.index ||
      (index === next.index && token.rawText.length > next.token.rawText.length)
    ) {
      next = { index, token };
    }
  }
  return next;
}

class InlineTokenMarkdownTransformer {
  private readonly occurrenceCounts = new Map<string, number>();

  constructor(private readonly tokens: readonly ChatInlineTokenViewModel[]) {}

  transform = (node: ChatMarkdownNode): ChatMarkdownNode => {
    if (node.type === "code" || node.type === "inlineCode" || !node.children) {
      return node;
    }
    return {
      ...node,
      children: node.children.flatMap((child) =>
        child.type === "text" && typeof child.value === "string"
          ? this.splitTextNode(child.value)
          : [this.transform(child)],
      ),
    };
  };

  private readonly splitTextNode = (value: string): ChatMarkdownNode[] => {
    const output: ChatMarkdownNode[] = [];
    let cursor = 0;

    while (cursor < value.length) {
      const next = findNextInlineToken(value, cursor, this.tokens);
      if (!next) {
        output.push({ type: "text", value: value.slice(cursor) });
        break;
      }
      if (next.index > cursor) {
        output.push({ type: "text", value: value.slice(cursor, next.index) });
      }
      const variants = this.tokens.filter(
        (token) => token.rawText === next.token.rawText,
      );
      const occurrence = this.occurrenceCounts.get(next.token.rawText) ?? 0;
      const token = variants[Math.min(occurrence, variants.length - 1)] ?? next.token;
      this.occurrenceCounts.set(next.token.rawText, occurrence + 1);
      output.push(createInlineTokenNode(token));
      cursor = next.index + next.token.rawText.length;
    }

    return output.length > 0 ? output : [{ type: "text", value }];
  };
}

export function createRemarkInlineTokenPlugin(
  inlineTokens: readonly ChatInlineTokenViewModel[],
) {
  const tokens = prepareInlineTokens(inlineTokens);
  return () => (tree: ChatMarkdownNode) => {
    return tokens.length > 0
      ? new InlineTokenMarkdownTransformer(tokens).transform(tree)
      : tree;
  };
}

function readStringProp(
  props: Record<string, unknown>,
  key: string,
): string | null {
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSkillSourceProp(
  props: Record<string, unknown>,
): Extract<ChatInlineTokenViewModel, { kind: "skill" }>["source"] {
  const value = readStringProp(props, INLINE_TOKEN_SOURCE_ATTR);
  return value === "builtin" ||
    value === "global" ||
    value === "project" ||
    value === "workspace"
    ? value
    : null;
}

export function readChatInlineTokenFromMarkdownProps(
  props: Record<string, unknown>,
): ChatInlineTokenViewModel | null {
  const kind = readStringProp(props, INLINE_TOKEN_KIND_ATTR);
  const label = readStringProp(props, INLINE_TOKEN_LABEL_ATTR);
  const rawText = readStringProp(props, INLINE_TOKEN_RAW_TEXT_ATTR);
  if (kind === "skill" && label && rawText) {
    const ref = readStringProp(props, INLINE_TOKEN_REF_ATTR);
    const name = readStringProp(props, INLINE_TOKEN_NAME_ATTR);
    return ref && name
      ? {
          kind,
          ref,
          name,
          source: readSkillSourceProp(props),
          path: readStringProp(props, INLINE_TOKEN_PATH_ATTR),
          label,
          rawText,
        }
      : null;
  }
  const key = readStringProp(props, INLINE_TOKEN_KEY_ATTR);
  return kind && key && label && rawText
    ? { kind, key, label, rawText }
    : null;
}
