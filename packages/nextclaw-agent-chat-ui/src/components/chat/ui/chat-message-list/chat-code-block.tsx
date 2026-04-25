import { useMemo, type ReactNode } from 'react';
import { useCopyFeedback } from '../../hooks/use-copy-feedback';
import type { ChatMessageTexts } from '../../view-models/chat-ui.types';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../internal/cn';
import { chatCodeSyntaxHighlighter } from './code-block/chat-code-syntax-highlighter';

const CODE_LANGUAGE_REGEX = /language-([a-z0-9-]+)/i;

function flattenNodeText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenNodeText).join('');
  }
  return '';
}

function normalizeCodeText(value: ReactNode): string {
  const content = flattenNodeText(value);
  return content.endsWith('\n') ? content.slice(0, -1) : content;
}

function resolveCodeLanguage(className?: string): string {
  const match = className ? CODE_LANGUAGE_REGEX.exec(className) : null;
  return match?.[1]?.toLowerCase() || 'text';
}

type ChatCodeBlockProps = {
  className?: string;
  children: ReactNode;
  texts: Pick<ChatMessageTexts, 'copyCodeLabel' | 'copiedCodeLabel'>;
};

export function ChatCodeBlock({ className, children, texts }: ChatCodeBlockProps) {
  const language = useMemo(() => resolveCodeLanguage(className), [className]);
  const codeText = useMemo(() => normalizeCodeText(children), [children]);
  const highlightedCode = useMemo(
    () => chatCodeSyntaxHighlighter.highlight(codeText, language),
    [codeText, language],
  );
  const codeClassName = useMemo(() => {
    const highlightedLanguageClass = `language-${highlightedCode.language}`;
    return cn(
      'hljs',
      className,
      className?.includes('language-') ? undefined : highlightedLanguageClass,
    );
  }, [className, highlightedCode.language]);
  const { copied, copy } = useCopyFeedback({ text: codeText });

  return (
    <div className="chat-codeblock">
      <div className="chat-codeblock-toolbar">
        <span className="chat-codeblock-language">{language}</span>
        <button
          type="button"
          className="chat-codeblock-copy"
          onClick={() => void copy()}
          aria-label={copied ? texts.copiedCodeLabel : texts.copyCodeLabel}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? texts.copiedCodeLabel : texts.copyCodeLabel}</span>
        </button>
      </div>
      <pre>
        <code
          className={codeClassName}
          data-highlighted={highlightedCode.highlighted ? 'true' : 'false'}
          dangerouslySetInnerHTML={{ __html: highlightedCode.html }}
        />
      </pre>
    </div>
  );
}
