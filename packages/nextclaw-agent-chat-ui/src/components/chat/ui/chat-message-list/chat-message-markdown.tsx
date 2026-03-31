import { useMemo, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../internal/cn';
import { ChatCodeBlock } from './chat-code-block';
import type { ChatMessageRole, ChatMessageTexts } from '../../view-models/chat-ui.types';

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

type ChatMessageMarkdownProps = {
  text: string;
  role: ChatMessageRole;
  texts: Pick<ChatMessageTexts, 'copyCodeLabel' | 'copiedCodeLabel'>;
  inline?: boolean;
};

export function ChatMessageMarkdown({
  text,
  role,
  texts,
  inline = false
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
      return (
        <a
          {...rest}
          href={safeHref}
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
  }), [inline, texts]);

  const WrapperTag = inline ? 'span' : 'div';

  return (
    <WrapperTag className={cn('chat-markdown', isUser ? 'chat-markdown-user' : 'chat-markdown-assistant')}>
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {trimMarkdown(text)}
      </ReactMarkdown>
    </WrapperTag>
  );
}
