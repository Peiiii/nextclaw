import { useMemo, type MouseEvent, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../internal/cn';
import { ChatCodeBlock } from './chat-code-block';
import type {
  ChatFileOpenActionViewModel,
  ChatMessageRole,
  ChatMessageTexts,
} from '../../view-models/chat-ui.types';

const MARKDOWN_MAX_CHARS = 140_000;
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

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
  if (href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
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
    href.startsWith('./') ||
    href.startsWith('../') ||
    href.startsWith('/Users/') ||
    href.startsWith('/home/') ||
    href.startsWith('/tmp/') ||
    href.startsWith('/var/') ||
    /^\/.+\.[A-Za-z0-9_-]+(?::\d+(?::\d+)?)?$/.test(href)
  );
}

function parseLocalFileAction(href: string): ChatFileOpenActionViewModel | null {
  const normalizedHref = href.split('#')[0]?.split('?')[0] ?? href;
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
    label: rawPath.split('/').filter(Boolean).pop() ?? rawPath,
    viewMode: 'preview',
    ...(typeof line === 'number' ? { line } : {}),
    ...(typeof column === 'number' ? { column } : {}),
  };
}

type ChatMessageMarkdownProps = {
  text: string;
  role: ChatMessageRole;
  texts: Pick<ChatMessageTexts, 'copyCodeLabel' | 'copiedCodeLabel'>;
  inline?: boolean;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
};

export function ChatMessageMarkdown({
  text,
  role,
  texts,
  inline = false,
  onFileOpen,
}: ChatMessageMarkdownProps) {
  const isUser = role === 'user';
  const markdownComponents = useMemo<Components>(() => ({
    p: ({ children }) => (inline ? <>{children}</> : <p>{children}</p>),
    a: ({ href, children, ...rest }) => {
      const safeHref = resolveSafeHref(href);
      if (!safeHref) {
        return <span className="chat-link-invalid">{children}</span>;
      }
      const external = isExternalHref(safeHref);
      const localFileAction = external ? null : parseLocalFileAction(safeHref);
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
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer noopener' : undefined}
        >
          {children}
        </a>
      );
    },
    table: ({ children, ...rest }) => (
      <div className="chat-table-wrap">
        <table {...rest}>{children}</table>
      </div>
    ),
    input: ({ type, checked, ...rest }) => {
      if (type !== 'checkbox') {
        return <input {...rest} type={type} />;
      }
      return <input {...rest} type="checkbox" checked={checked} readOnly disabled className="chat-task-checkbox" />;
    },
    img: ({ src, alt, ...rest }) => {
      const safeSrc = resolveSafeHref(src);
      if (!safeSrc) {
        return null;
      }
      return <img {...rest} src={safeSrc} alt={alt || ''} loading="lazy" decoding="async" />;
    },
    code: ({ className, children, ...rest }) => {
      const plainText = String(children ?? '');
      const isInlineCode = !className && !plainText.includes('\n');
      if (isInlineCode) {
        return (
          <code {...rest} className={cn('chat-inline-code', className)}>
            {children}
          </code>
        );
      }
      return (
        <ChatCodeBlock className={className} texts={texts}>
          {children as ReactNode}
        </ChatCodeBlock>
      );
    }
  }), [inline, onFileOpen, texts]);

  const WrapperTag = inline ? 'span' : 'div';

  return (
    <WrapperTag className={cn('chat-markdown', isUser ? 'chat-markdown-user' : 'chat-markdown-assistant')}>
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {trimMarkdown(text)}
      </ReactMarkdown>
    </WrapperTag>
  );
}
