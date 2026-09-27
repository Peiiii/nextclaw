import { useChatResourceLinkIcon } from './chat-resource-link-provider';
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type MouseEvent,
  type ReactNode,
  type CSSProperties,
} from "react";
import type { Components, Options } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { remarkFrontmatterDisplay } from "./utils/chat-frontmatter.utils";
import { ChatMarkdownFrontmatter } from "./chat-markdown-frontmatter";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { chatMarkdownHtmlSchema, createRehypeChatMarkdownIds } from "./utils/chat-markdown-html.utils";
import { ChatMarkdownDetails } from "./markdown/chat-markdown-details";
import "katex/dist/katex.min.css";
import { createRemarkLatexDelimitersPlugin } from "./utils/chat-latex-delimiters.utils";
import { createRemarkStreamingMathPlugin, rehypeStreamingMath } from "./utils/chat-streaming-math.utils";
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
import { countChatReferenceCharacters } from "@agent-chat-ui/components/chat/ui/chat-reference-tag";
import {
  isExternalChatResourceHref,
  parseChatLocalFileAction,
  resolveSafeChatResourceHref,
  transformChatResourceHref,
} from "./utils/chat-local-resource.utils";
import {
  createRemarkInlineTokenPlugin,
  readChatInlineTokenFromMarkdownProps,
  type ChatMarkdownNode,
} from "./utils/chat-inline-token-markdown.utils";

const MARKDOWN_MAX_CHARS = 140_000;
const MATH_STYLES: Record<string, CSSProperties> = {
  "katex-display": { overflowX: "auto", overflowY: "hidden", paddingBlock: "0.25em" },
};

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
    | "frontmatterLabel"
    | "detailsLabel"
    | "copiedCodeLabel"
    | "attachmentExpandLabel"
    | "attachmentCloseLabel"
    | "excerptCharacterCountTemplate"
    | "mermaidDiagramLabel"
    | "mermaidExpandLabel"
    | "mermaidLoadingLabel"
    | "mermaidRenderErrorLabel"
    | "previewZoomInLabel"
    | "previewZoomOutLabel"
    | "previewResetZoomLabel"
    | "footnoteLabel"
    | "footnoteBackLabel"
    | "imageAltLabel"
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
  renderCodeBlock?: (code: { source: string; language: string; isStreaming: boolean }) => ReactNode;
  allowHtml?: boolean;
  urlTransform?: Options["urlTransform"];
};

function isSingleLineImageParagraph(
  node: ChatMarkdownNode | undefined,
): boolean {
  let imageCount = 0;
  for (const child of node?.children ?? []) {
    if (child.type === "text") {
      const text = child.value ?? "";
      if (
        text.trim().length > 0 ||
        text.includes("\n") ||
        text.includes("\r")
      ) {
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
const ChatMarkdownCodeBlockContext = createContext(false);

function useChatMessageMarkdownRuntime(): ChatMessageMarkdownRuntime {
  const runtime = useContext(ChatMessageMarkdownRuntimeContext);
  if (!runtime) {
    throw new Error(
      "Chat message Markdown renderer requires its runtime context",
    );
  }
  return runtime;
}

const CHAT_MESSAGE_MARKDOWN_COMPONENTS: Components = {
  // Block components already own their pre/figure containers.
  pre: function ChatMarkdownCodeContainer({ node, children, ...rest }) {
    const child = node?.children.length === 1 ? node.children[0] : null;
    return child?.type === "element" && child.tagName === "code"
      ? <ChatMarkdownCodeBlockContext.Provider value>{children}</ChatMarkdownCodeBlockContext.Provider>
      : <pre {...rest}>{children}</pre>;
  },
  details: function ChatMarkdownDisclosure({ node, children, open }) {
    const { texts } = useChatMessageMarkdownRuntime();
    return <ChatMarkdownDetails node={node} open={open} label={texts.detailsLabel ?? "Details"}>{children}</ChatMarkdownDetails>;
  },
  summary: () => null,
  div: function ChatMarkdownBlock({ node: _node, children, ...rest }) {
    const { texts } = useChatMessageMarkdownRuntime();
    const source = (rest as Record<string, unknown>)["data-frontmatter"];
    const pendingMath = (rest as Record<string, unknown>)["data-chat-math-pending"];
    return typeof source === "string"
      ? <ChatMarkdownFrontmatter source={source} label={texts.frontmatterLabel ?? "Document properties"} />
      : pendingMath ? <div {...rest} style={{ minHeight: "3em", display: "flex", alignItems: "center", justifyContent: "center", opacity: .6 }}>{children}</div>
      : <div {...rest}>{children}</div>;
  },
  p: function ChatMarkdownParagraph({ node, children }) {
    const { inline } = useChatMessageMarkdownRuntime();
    return inline ? (
      <>{children}</>
    ) : (
      <p
        data-chat-image-row={
          isSingleLineImageParagraph(node as ChatMarkdownNode)
            ? "three-column"
            : undefined
        }
      >
        {children}
      </p>
    );
  },

  span: function ChatMarkdownSpan({ node: _node, children, ...rest }) {
    const { onInlineTokenClick, texts } = useChatMessageMarkdownRuntime();
    const token = readChatInlineTokenFromMarkdownProps(
      rest as Record<string, unknown>,
    );
    if (token) {
      const excerptToken = "excerpt" in token ? token : null;
      const workspaceExcerptToken =
        token.kind === "workspace_excerpt" && "path" in token ? token : null;
      return (
        <ChatInlineTokenBadge
          characterCountLabel={
            workspaceExcerptToken
              ? texts.excerptCharacterCountTemplate?.replace(
                  "{count}",
                  String(
                    countChatReferenceCharacters(workspaceExcerptToken.excerpt),
                  ),
                )
              : undefined
          }
          excerpt={excerptToken?.excerpt}
          kind={token.kind}
          label={token.label}
          location={
            workspaceExcerptToken?.startLine
              ? workspaceExcerptToken.startLine ===
                  workspaceExcerptToken.endLine ||
                !workspaceExcerptToken.endLine
                ? `L${workspaceExcerptToken.startLine}`
                : `L${workspaceExcerptToken.startLine}–${workspaceExcerptToken.endLine}`
              : undefined
          }
          path={workspaceExcerptToken?.path}
          tooltip={"ref" in token ? token.name : token.key}
          onClick={
            onInlineTokenClick && token.kind !== "conversation_excerpt"
              ? () => onInlineTokenClick(token)
              : undefined
          }
        />
      );
    }
    return (
      <span
        {...rest}
        style={{ ...rest.style, ...MATH_STYLES[rest.className ?? ""] }}
      >
        {children}
      </span>
    );
  },

  a: function ChatMarkdownLink({ node: _node, href, children, ...rest }) {
    const { onFileOpen } = useChatMessageMarkdownRuntime();
    const safeHref = resolveSafeChatResourceHref(href);
    const resourceIcon = useChatResourceLinkIcon(safeHref);
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
        {resourceIcon && <span aria-hidden="true" className="inline-flex empty:hidden" style={{ marginInlineEnd: '0.25em', verticalAlign: '-0.1em' }}>{resourceIcon}</span>}{children}
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

  img: function ChatMarkdownImage({ node: _node, src, alt, title }) {
    const { resolveFileContentUrl, texts } = useChatMessageMarkdownRuntime();
    const safeSrc = resolveSafeChatResourceHref(src);
    if (!safeSrc) {
      return <span className="chat-image-fallback">{alt || texts.imageAltLabel || ""}</span>;
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
        resetZoomLabel={texts.previewResetZoomLabel}
        sizeLabel={null}
        src={resolvedSrc}
        title={title}
        fallbackLabel={texts.imageAltLabel}
        zoomInLabel={texts.previewZoomInLabel}
        zoomOutLabel={texts.previewZoomOutLabel}
      />
    );
  },

  code: function ChatMarkdownCode({
    node: _node,
    className,
    children,
    ...rest
  }) {
    const { isStreaming, renderInlineDisplay, renderCodeBlock, texts } =
      useChatMessageMarkdownRuntime();
    const plainText = String(children ?? "");
    const isInlineCode = !useContext(ChatMarkdownCodeBlockContext);
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
    if (renderCodeBlock) {
      return renderCodeBlock({ source: plainText, language: /language-([^\s]+)/.exec(className ?? "")?.[1] ?? "text", isStreaming });
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
  renderCodeBlock,
  allowHtml = true,
  urlTransform = transformChatResourceHref,
}: ChatMessageMarkdownProps) {
  const isUser = role === "user";
  const messageId = useId();
  const scopeIds = useMemo(() => createRehypeChatMarkdownIds(`chat-${messageId.replace(/[^a-zA-Z0-9_-]/g, "")}-`), [messageId]);
  const markdown = trimMarkdown(text);
  const remarkPlugins: NonNullable<Options["remarkPlugins"]> = inlineTokens?.length
    ? [remarkGfm, remarkMath, createRemarkLatexDelimitersPlugin(markdown), createRemarkInlineTokenPlugin(inlineTokens)]
    : [remarkGfm, remarkMath, createRemarkLatexDelimitersPlugin(markdown)];
  if (isStreaming) remarkPlugins.push(createRemarkStreamingMathPlugin(markdown));
  if (!inline) remarkPlugins.unshift(remarkFrontmatter, remarkFrontmatterDisplay);
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
        renderCodeBlock,
        resolveFileContentUrl,
        texts,
      }}
    >
      <WrapperTag
        data-stream-phase={isStreaming ? text.length % 3 : undefined}
        className={cn(
          "chat-markdown",
          isUser ? "chat-markdown-user" : "chat-markdown-assistant",
        )}
      >
        <ReactMarkdown
          skipHtml={inline || !allowHtml}
          remarkRehypeOptions={{ footnoteLabel: texts.footnoteLabel ?? "Footnotes", footnoteBackLabel: texts.footnoteBackLabel ?? "Back to reference" }}
          remarkPlugins={remarkPlugins}
          rehypePlugins={[
            ...(!inline && allowHtml ? [rehypeRaw, [rehypeSanitize, chatMarkdownHtmlSchema]] as NonNullable<Options["rehypePlugins"]> : []),
            scopeIds,
            [rehypeKatex, { trust: false, maxExpand: 1000, ...(isStreaming ? { errorColor: "currentColor" } : {}) }],
            ...(isStreaming ? [rehypeStreamingMath] : []),
          ]}
          components={CHAT_MESSAGE_MARKDOWN_COMPONENTS}
          urlTransform={urlTransform}
        >
          {markdown}
        </ReactMarkdown>
      </WrapperTag>
    </ChatMessageMarkdownRuntimeContext.Provider>
  );
}
