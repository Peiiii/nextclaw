import { useMemo } from "react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { chatCodeSyntaxHighlighter } from "@agent-chat-ui/components/chat/ui/chat-message-list/code-block/chat-code-syntax-highlighter";
import {
  ansiToHtml,
  hasAnsiSequences,
  stripAnsiSequences,
} from "./terminal-ansi.utils";

const MAX_TERMINAL_TEXT_CHARS = 120_000;

function clampTerminalText(value: string): string {
  if (value.length <= MAX_TERMINAL_TEXT_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_TERMINAL_TEXT_CHARS)}\n…`;
}

function TerminalCode({
  code,
  language,
  preferAnsi = false,
  className,
}: {
  code: string;
  language: string;
  preferAnsi?: boolean;
  className?: string;
}) {
  const source = clampTerminalText(code);
  const content = useMemo(() => {
    if (preferAnsi && hasAnsiSequences(source)) {
      return {
        html: ansiToHtml(source),
        language: "ansi",
        highlighted: true,
      };
    }
    const plain = stripAnsiSequences(source);
    return chatCodeSyntaxHighlighter.highlight(plain, language);
  }, [language, preferAnsi, source]);

  return (
    <code
      className={cn(
        "hljs chat-terminal-code",
        `language-${content.language}`,
        className,
      )}
      data-highlighted={content.highlighted ? "true" : "false"}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}

/**
 * Compact terminal-style surface for command tools.
 * Style only — no decorative window chrome.
 */
export function ChatTerminalSurface({
  command,
  output,
  emptyLabel,
  isRunning,
  hasOutput,
  isError = false,
}: {
  command?: string | null;
  output: string;
  emptyLabel: string;
  isRunning: boolean;
  hasOutput: boolean;
  isError?: boolean;
  exitCode?: number | null;
  workingDir?: string | null;
}) {
  return (
    <div
      className={cn(
        "chat-terminal-surface",
        isError ? "chat-terminal-surface-error" : undefined,
      )}
      data-testid="chat-terminal-surface"
    >
      <div className="chat-terminal-body custom-scrollbar">
        <div className="chat-terminal-line chat-terminal-line-command">
          <span className="chat-terminal-gutter" aria-hidden="true">
            $
          </span>
          <div className="chat-terminal-line-content">
            {command ? (
              <pre className="chat-terminal-pre">
                <TerminalCode code={command} language="bash" />
                {isRunning && !hasOutput ? (
                  <span className="chat-terminal-caret" aria-hidden="true" />
                ) : null}
              </pre>
            ) : (
              <div className="chat-terminal-skeleton" />
            )}
          </div>
        </div>

        {(hasOutput || !isRunning) && (
          <div className="chat-terminal-output-block">
            {hasOutput ? (
              <pre
                className={cn(
                  "chat-terminal-pre chat-terminal-output",
                  isError ? "chat-terminal-pre-error" : undefined,
                )}
              >
                <TerminalCode
                  code={output}
                  language={isError ? "text" : "shell"}
                  preferAnsi
                  className={isError ? "chat-terminal-code-error" : undefined}
                />
                {isRunning ? (
                  <span className="chat-terminal-caret" aria-hidden="true" />
                ) : null}
              </pre>
            ) : (
              <div className="chat-terminal-empty">{emptyLabel}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
