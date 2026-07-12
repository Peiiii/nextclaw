import { useMemo, type MouseEvent, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatInlineTokenBadge } from "./chat-inline-token-badge";
import { ChatCodeBlock } from "./chat-code-block";
import { ChatInlineDisplay } from "./chat-inline-display";
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
  ChatInlineTokenViewModel,
  ChatMessageRole,
  ChatMessageTexts,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import {
  isChatInlineDisplayLanguage,
  parseChatInlineDisplayDirective,
} from "./utils/chat-inline-display.utils";

const MARKDOWN_MAX_CHARS = 140_000;
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const INLINE_TOKEN_KIND_ATTR = "data-chat-inline-token-kind";
const INLINE_TOKEN_KEY_ATTR = "data-chat-inline-token-key";
const INLINE_TOKEN_LABEL_ATTR = "data-chat-inline-token-label";
const INLINE_TOKEN_RAW_TEXT_ATTR = "data-chat-inline-token-raw-text";
const PROJECT_RELATIVE_FILE_EXTENSION_PATTERN =
  "cjs|css|cts|html?|js|json|jsx|mdx?|mjs|mts|tsx?|txt|ya?ml";
const PROJECT_RELATIVE_FILE_HREF_PATTERN = new RegExp(
  `^(?![a-zA-Z][a-zA-Z\\d+.-]*:)(?!//)(?:(?:[^/\\s?#]+/)+[^?#\\s]+\\.[A-Za-z0-9_-]+|[^/\\s?#]+\\.(?:${PROJECT_RELATIVE_FILE_EXTENSION_PATTERN}))(?::\\d+(?::\\d+)?)?(?:[?#].*)?$`,
  "i",
);

function trimMarkdown(value: string): string {
  if (value.length <= MARKDOWN_MAX_CHARS) {
    return value;
  }
  return `${value.slice(0, MARKDOWN_MAX_CHARS)}\n\n...`;
}

function resolveSafeHref(href?: string): string | null {
  if (!href) {
    return null;
  }
  if (
    href.startsWith("#") ||
    href.startsWith("/") ||
    href.startsWith("./") ||
    href.startsWith("../") ||
    PROJECT_RELATIVE_FILE_HREF_PATTERN.test(href)
  ) {
    return href;
  }
  try {
    const url = new URL(href);
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? href : null;
  } catch {
    return null;
  }
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function looksLikeLocalFileHref(href: string): boolean {
  return (
    href.startsWith("./") ||
    href.startsWith("../") ||
    href.startsWith("/Users/") ||
    href.startsWith("/home/") ||
    href.startsWith("/tmp/") ||
    href.startsWith("/var/") ||
    PROJECT_RELATIVE_FILE_HREF_PATTERN.test(href) ||
    /^\/.+\.[A-Za-z0-9_-]+(?::\d+(?::\d+)?)?$/.test(href)
  );
}

function parseLocalFileAction(
  href: string,
): ChatFileOpenActionViewModel | null {
  const viewer = new URLSearchParams(href.split("#")[0]?.split("?")[1] ?? "").get("viewer");
  const normalizedHref = href.split("#")[0]?.split("?")[0] ?? href;
  const decodedHref = decodeURIComponent(normalizedHref);
  if (!looksLikeLocalFileHref(decodedHref)) {
    return null;
  }
  const lineMatch = /^(.*?)(?::(\d+)(?::(\d+))?)$/.exec(decodedHref);
  const rawPath = lineMatch?.[1] ?? decodedHref;
  const line = lineMatch?.[2] ? Number(lineMatch[2]) : undefined;
  const column = lineMatch?.[3] ? Number(lineMatch[3]) : undefined;
  return {
    path: rawPath,
    label: rawPath.split("/").filter(Boolean).pop() ?? rawPath,
    viewMode: "preview",
    ...(viewer === "source" || viewer === "rendered" ? { previewViewer: viewer } : {}),
    ...(typeof line === "number" ? { line } : {}),
    ...(typeof column === "number" ? { column } : {}),
  };
}

type ChatMessageMarkdownProps = {
  text: string;
  role: ChatMessageRole;
  texts: Pick<ChatMessageTexts, "copyCodeLabel" | "copiedCodeLabel">;
  inline?: boolean;
  inlineTokens?: readonly ChatInlineTokenViewModel[];
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  onInlineTokenClick?: (token: ChatInlineTokenViewModel) => void;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
};

type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
    hChildren?: Array<{ type: "text"; value: string }>;
  };
};

function prepareInlineTokens(
  inlineTokens: readonly ChatInlineTokenViewModel[] | undefined,
): ChatInlineTokenViewModel[] {
  if (!inlineTokens || inlineTokens.length === 0) {
    return [];
  }
  const seenRawTexts = new Set<string>();
  const tokens: ChatInlineTokenViewModel[] = [];
  for (const token of inlineTokens) {
    if (!token.rawText || seenRawTexts.has(token.rawText)) {
      continue;
    }
    seenRawTexts.add(token.rawText);
    tokens.push(token);
  }
  return tokens.sort((left, right) => right.rawText.length - left.rawText.length);
}

function createInlineTokenNode(token: ChatInlineTokenViewModel): MarkdownNode {
  return {
    type: "chatInlineToken",
    data: {
      hName: "span",
      hProperties: {
        [INLINE_TOKEN_KIND_ATTR]: token.kind,
        [INLINE_TOKEN_KEY_ATTR]: token.key,
        [INLINE_TOKEN_LABEL_ATTR]: token.label,
        [INLINE_TOKEN_RAW_TEXT_ATTR]: token.rawText,
      },
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

function splitTextNodeByInlineTokens(
  value: string,
  tokens: readonly ChatInlineTokenViewModel[],
): MarkdownNode[] {
  const output: MarkdownNode[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const next = findNextInlineToken(value, cursor, tokens);
    if (!next) {
      output.push({ type: "text", value: value.slice(cursor) });
      break;
    }
    if (next.index > cursor) {
      output.push({ type: "text", value: value.slice(cursor, next.index) });
    }
    output.push(createInlineTokenNode(next.token));
    cursor = next.index + next.token.rawText.length;
  }

  return output.length > 0 ? output : [{ type: "text", value }];
}

function transformInlineTokenTextNodes(
  node: MarkdownNode,
  tokens: readonly ChatInlineTokenViewModel[],
): void {
  if (node.type === "code" || node.type === "inlineCode" || !node.children) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      nextChildren.push(...splitTextNodeByInlineTokens(child.value, tokens));
      continue;
    }
    transformInlineTokenTextNodes(child, tokens);
    nextChildren.push(child);
  }
  node.children = nextChildren;
}

function createRemarkInlineTokenPlugin(
  inlineTokens: readonly ChatInlineTokenViewModel[],
) {
  const tokens = prepareInlineTokens(inlineTokens);
  return () => (tree: MarkdownNode) => {
    if (tokens.length === 0) {
      return;
    }
    transformInlineTokenTextNodes(tree, tokens);
  };
}

function readStringProp(props: Record<string, unknown>, key: string): string | null {
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function ChatMessageMarkdown({
  text,
  role,
  texts,
  inline = false,
  inlineTokens,
  onFileOpen,
  onInlineTokenClick,
  renderInlineDisplay,
}: ChatMessageMarkdownProps) {
  const isUser = role === "user";
  const remarkPlugins = useMemo(
    () =>
      inlineTokens && inlineTokens.length > 0
        ? [remarkGfm, createRemarkInlineTokenPlugin(inlineTokens)]
        : [remarkGfm],
    [inlineTokens],
  );
  const markdownComponents = useMemo<Components>(
    () => ({
      p: ({ children }) => (inline ? <>{children}</> : <p>{children}</p>),
      span: ({ node: _node, children, ...rest }) => {
        const restProps = rest as Record<string, unknown>;
        const kind = readStringProp(restProps, INLINE_TOKEN_KIND_ATTR);
        const key = readStringProp(restProps, INLINE_TOKEN_KEY_ATTR);
        const label = readStringProp(restProps, INLINE_TOKEN_LABEL_ATTR);
        const rawText = readStringProp(restProps, INLINE_TOKEN_RAW_TEXT_ATTR);
        if (kind && key && label && rawText) {
          return (
            <ChatInlineTokenBadge
              kind={kind}
              label={label}
              isUser={isUser}
              onClick={
                onInlineTokenClick
                  ? () => onInlineTokenClick({ kind, key, label, rawText })
                  : undefined
              }
            />
          );
        }
        return <span {...rest}>{children}</span>;
      },
      a: ({ node: _node, href, children, ...rest }) => {
        const safeHref = resolveSafeHref(href);
        if (!safeHref) {
          return <span className="chat-link-invalid">{children}</span>;
        }
        const external = isExternalHref(safeHref);
        const localFileAction = external
          ? null
          : parseLocalFileAction(safeHref);
        const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
          if (!onFileOpen || !localFileAction) {
            return;
          }
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          onFileOpen(localFileAction);
        };
        return (
          <a
            {...rest}
            href={safeHref}
            onClick={handleClick}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer noopener" : undefined}
          >
            {children}
          </a>
        );
      },
      table: ({ node: _node, children, ...rest }) => (
        <div className="chat-table-wrap">
          <table {...rest}>{children}</table>
        </div>
      ),
      input: ({ node: _node, type, checked, ...rest }) => {
        if (type !== "checkbox") {
          return <input {...rest} type={type} />;
        }
        return (
          <input
            {...rest}
            type="checkbox"
            checked={checked}
            readOnly
            disabled
            className="chat-task-checkbox"
          />
        );
      },
      img: ({ node: _node, src, alt, ...rest }) => {
        const safeSrc = resolveSafeHref(src);
        if (!safeSrc) {
          return null;
        }
        return (
          <img
            {...rest}
            src={safeSrc}
            alt={alt || ""}
            loading="lazy"
            decoding="async"
          />
        );
      },
      code: ({ node: _node, className, children, ...rest }) => {
        const plainText = String(children ?? "");
        const isInlineCode = !className && !plainText.includes("\n");
        if (isInlineCode) {
          return (
            <code {...rest} className={cn("chat-inline-code", className)}>
              {children}
            </code>
          );
        }
        const inlineDisplay = isChatInlineDisplayLanguage(className)
          ? parseChatInlineDisplayDirective(plainText)
          : null;
        if (inlineDisplay) {
          return (
            <ChatInlineDisplay
              display={inlineDisplay}
              renderInlineDisplay={renderInlineDisplay}
            />
          );
        }
        return (
          <ChatCodeBlock className={className} texts={texts}>
            {children as ReactNode}
          </ChatCodeBlock>
        );
      },
    }),
    [inline, isUser, onFileOpen, onInlineTokenClick, renderInlineDisplay, texts],
  );

  const WrapperTag = inline ? "span" : "div";

  return (
    <WrapperTag
      className={cn(
        "chat-markdown",
        isUser ? "chat-markdown-user" : "chat-markdown-assistant",
      )}
    >
      <ReactMarkdown
        skipHtml
        remarkPlugins={remarkPlugins}
        components={markdownComponents}
      >
        {trimMarkdown(text)}
      </ReactMarkdown>
    </WrapperTag>
  );
}
