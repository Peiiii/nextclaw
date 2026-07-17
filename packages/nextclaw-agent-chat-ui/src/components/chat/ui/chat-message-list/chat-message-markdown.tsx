import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatInlineTokenBadge } from "./chat-inline-token-badge";
import { ChatCodeBlock } from "./chat-code-block";
import { ChatInlineDisplay } from "./chat-inline-display";
import { ChatMermaidDiagram } from "./mermaid/chat-mermaid-diagram";
import { ChatMessageImagePreview } from "./chat-message-file/chat-message-image-preview";
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
import {
  isExternalChatResourceHref,
  parseChatLocalFileAction,
  resolveSafeChatResourceHref,
  transformChatResourceHref,
} from "./utils/chat-local-resource.utils";

const MARKDOWN_MAX_CHARS = 140_000;
const INLINE_TOKEN_KIND_ATTR = "data-chat-inline-token-kind";
const INLINE_TOKEN_KEY_ATTR = "data-chat-inline-token-key";
const INLINE_TOKEN_LABEL_ATTR = "data-chat-inline-token-label";
const INLINE_TOKEN_RAW_TEXT_ATTR = "data-chat-inline-token-raw-text";

function trimMarkdown(value: string): string {
  if (value.length <= MARKDOWN_MAX_CHARS) {
    return value;
  }
  return `${value.slice(0, MARKDOWN_MAX_CHARS)}\n\n...`;
}

type ChatMessageMarkdownProps = {
  text: string;
  role: ChatMessageRole;
  texts: Pick<
    ChatMessageTexts,
    | "copyCodeLabel"
    | "copiedCodeLabel"
    | "attachmentExpandLabel"
    | "attachmentCloseLabel"
    | "mermaidDiagramLabel"
    | "mermaidLoadingLabel"
    | "mermaidRenderErrorLabel"
  >;
  inline?: boolean;
  isStreaming?: boolean;
  inlineTokens?: readonly ChatInlineTokenViewModel[];
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  resolveFileContentUrl?: (
    action: ChatFileOpenActionViewModel,
  ) => string | null;
  onInlineTokenClick?: (token: ChatInlineTokenViewModel) => void;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
};

type MarkdownNode = {
  type?: string;
  tagName?: string;
  value?: string;
  children?: MarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string>;
    hChildren?: Array<{ type: "text"; value: string }>;
  };
};

function isSingleLineImageParagraph(node: MarkdownNode | undefined): boolean {
  let imageCount = 0;
  for (const child of node?.children ?? []) {
    if (child.type === "text") {
      const text = child.value ?? "";
      if (text.trim().length > 0 || text.includes("\n") || text.includes("\r")) {
        return false;
      }
      continue;
    }
    if (child.tagName !== "img") {
      return false;
    }
    imageCount += 1;
  }
  return imageCount >= 3;
}

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
  return tokens.sort(
    (left, right) => right.rawText.length - left.rawText.length,
  );
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
): MarkdownNode {
  if (node.type === "code" || node.type === "inlineCode" || !node.children) {
    return node;
  }

  return {
    ...node,
    children: node.children.flatMap((child) =>
      child.type === "text" && typeof child.value === "string"
        ? splitTextNodeByInlineTokens(child.value, tokens)
        : [transformInlineTokenTextNodes(child, tokens)],
    ),
  };
}

function createRemarkInlineTokenPlugin(
  inlineTokens: readonly ChatInlineTokenViewModel[],
) {
  const tokens = prepareInlineTokens(inlineTokens);
  return () => (tree: MarkdownNode) =>
    tokens.length > 0 ? transformInlineTokenTextNodes(tree, tokens) : tree;
}

function readStringProp(
  props: Record<string, unknown>,
  key: string,
): string | null {
  const value = props[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

type ChatMessageMarkdownRuntime = Omit<
  ChatMessageMarkdownProps,
  "text" | "role" | "inlineTokens" | "isStreaming"
> & {
  inline: boolean;
  isStreaming: boolean;
  isUser: boolean;
};

const ChatMessageMarkdownRuntimeContext =
  createContext<ChatMessageMarkdownRuntime | null>(null);

function useChatMessageMarkdownRuntime(): ChatMessageMarkdownRuntime {
  const runtime = useContext(ChatMessageMarkdownRuntimeContext);
  if (!runtime) {
    throw new Error("Chat message Markdown renderer requires its runtime context");
  }
  return runtime;
}

const CHAT_MESSAGE_MARKDOWN_COMPONENTS: Components = {
  p: function ChatMarkdownParagraph({ node, children }) {
    const { inline } = useChatMessageMarkdownRuntime();
    return inline ? (
      <>{children}</>
    ) : (
      <p
        data-chat-image-row={
          isSingleLineImageParagraph(node as MarkdownNode)
            ? "three-column"
            : undefined
        }
      >
        {children}
      </p>
    );
  },

  span: function ChatMarkdownSpan({ node: _node, children, ...rest }) {
    const { onInlineTokenClick } = useChatMessageMarkdownRuntime();
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
          tooltip={key}
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

  a: function ChatMarkdownLink({ node: _node, href, children, ...rest }) {
    const { onFileOpen } = useChatMessageMarkdownRuntime();
    const safeHref = resolveSafeChatResourceHref(href);
    const external = safeHref ? isExternalChatResourceHref(safeHref) : false;
    const localFileAction = external
      ? null
      : safeHref
        ? parseChatLocalFileAction(safeHref)
        : null;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (!safeHref) {
        event.preventDefault();
        return;
      }
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
        className={cn(rest.className, !safeHref && "chat-link-invalid")}
        href={safeHref ?? "#"}
        aria-disabled={!safeHref || undefined}
        onClick={handleClick}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      >
        {children}
      </a>
    );
  },

  table: function ChatMarkdownTable({ node: _node, children, ...rest }) {
    return (
      <div className="chat-table-wrap">
        <table {...rest}>{children}</table>
      </div>
    );
  },

  input: function ChatMarkdownInput({ node: _node, type, checked, ...rest }) {
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

  img: function ChatMarkdownImage({ node: _node, src, alt }) {
    const { resolveFileContentUrl, texts } = useChatMessageMarkdownRuntime();
    const safeSrc = resolveSafeChatResourceHref(src);
    if (!safeSrc) {
      return null;
    }
    const localFileAction = parseChatLocalFileAction(safeSrc);
    const resolvedSrc =
      localFileAction && resolveFileContentUrl
        ? resolveFileContentUrl(localFileAction)
        : safeSrc;
    if (!resolvedSrc) {
      return null;
    }
    return (
      <ChatMessageImagePreview
        alt={alt || ""}
        closeLabel={texts.attachmentCloseLabel ?? "Close preview"}
        expandLabel={texts.attachmentExpandLabel ?? "Expand image"}
        sizeLabel={null}
        src={resolvedSrc}
      />
    );
  },

  code: function ChatMarkdownCode({
    node: _node,
    className,
    children,
    ...rest
  }) {
    const { isStreaming, renderInlineDisplay, texts } =
      useChatMessageMarkdownRuntime();
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
    if (className?.split(" ").includes("language-mermaid")) {
      return (
        <ChatMermaidDiagram
          isStreaming={isStreaming}
          source={plainText}
          texts={texts}
        />
      );
    }
    return (
      <ChatCodeBlock className={className} texts={texts}>
        {children as ReactNode}
      </ChatCodeBlock>
    );
  },
};

export function ChatMessageMarkdown({
  text,
  role,
  texts,
  inline = false,
  isStreaming = false,
  inlineTokens,
  onFileOpen,
  onInlineTokenClick,
  resolveFileContentUrl,
  renderInlineDisplay,
}: ChatMessageMarkdownProps) {
  const isUser = role === "user";
  const remarkPlugins = inlineTokens?.length
    ? [remarkGfm, createRemarkInlineTokenPlugin(inlineTokens)]
    : [remarkGfm];
  const WrapperTag = inline ? "span" : "div";

  return (
    <ChatMessageMarkdownRuntimeContext.Provider
      value={{
        inline,
        isStreaming,
        isUser,
        onFileOpen,
        onInlineTokenClick,
        renderInlineDisplay,
        resolveFileContentUrl,
        texts,
      }}
    >
      <WrapperTag
        className={cn(
          "chat-markdown",
          isUser ? "chat-markdown-user" : "chat-markdown-assistant",
        )}
      >
        <ReactMarkdown
          skipHtml
          remarkPlugins={remarkPlugins}
          components={CHAT_MESSAGE_MARKDOWN_COMPONENTS}
          urlTransform={transformChatResourceHref}
        >
          {trimMarkdown(text)}
        </ReactMarkdown>
      </WrapperTag>
    </ChatMessageMarkdownRuntimeContext.Provider>
  );
}
