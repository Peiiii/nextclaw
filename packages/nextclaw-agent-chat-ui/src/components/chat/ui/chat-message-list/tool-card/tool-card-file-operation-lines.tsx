import { useLayoutEffect, useMemo, useRef, type Ref } from "react";
import type {
  ChatFileOperationBlockViewModel,
  ChatFileOperationLineViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { chatCodeSyntaxHighlighter } from "@agent-chat-ui/components/chat/ui/chat-message-list/code-block/chat-code-syntax-highlighter";

const FILE_TEXT_CLASS_NAME = "font-mono text-[11px] leading-5";
const FILE_ROW_CLASS_NAME = `flex h-5 w-full ${FILE_TEXT_CLASS_NAME}`;
const FILE_LINE_NUMBER_CELL_CLASS_NAME =
  "flex h-5 items-center justify-center px-2.5 tabular-nums select-none";

function readVisibleLineNumber(line: ChatFileOperationLineViewModel): string {
  return String(line.newLineNumber ?? line.oldLineNumber ?? "");
}

function isTargetLine(
  line: ChatFileOperationLineViewModel,
  targetLine?: number | null,
): boolean {
  return typeof targetLine === "number" && (line.newLineNumber ?? line.oldLineNumber) === targetLine;
}

function readLineKey(
  prefix: string,
  line: ChatFileOperationLineViewModel,
  index: number,
): string {
  return `${prefix}-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`;
}

function hasVisibleLineNumber(line: ChatFileOperationLineViewModel): boolean {
  return (
    typeof line.newLineNumber === "number" ||
    typeof line.oldLineNumber === "number"
  );
}

function readHasBlockLineNumbers(block: ChatFileOperationBlockViewModel): boolean {
  return block.lines.some(hasVisibleLineNumber);
}

function readLineNumberColumnWidth(
  block: ChatFileOperationBlockViewModel,
): string {
  const maxDigits = block.lines.reduce((currentMax, line) => {
    if (!hasVisibleLineNumber(line)) {
      return currentMax;
    }
    return Math.max(currentMax, readVisibleLineNumber(line).length);
  }, 0);
  const width = Math.max(6.5, Math.min(8, maxDigits + 3.5));
  return `${width}ch`;
}

function readCodeColumnWidth(block: ChatFileOperationBlockViewModel): string {
  const maxColumns = block.lines.reduce(
    (currentMax, line) => Math.max(currentMax, Math.max(1, line.text.length)),
    1,
  );
  return `calc(${maxColumns}ch + 1.25rem)`;
}

function readPathExtension(path: string): string | null {
  const fileName = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const cleanName = fileName.split(/[?#]/)[0] ?? fileName;
  const extensionStart = cleanName.lastIndexOf(".");
  if (extensionStart <= 0 || extensionStart === cleanName.length - 1) {
    return null;
  }
  return cleanName.slice(extensionStart + 1).toLowerCase();
}

function readBlockLanguage(block: ChatFileOperationBlockViewModel): string {
  const hint = block.languageHint?.trim();
  return hint || readPathExtension(block.path) || "text";
}

function readLanguageClassName(language: string): string {
  const normalized = language.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return normalized ? `language-${normalized}` : "language-text";
}

function getLineNumberTone(line: ChatFileOperationLineViewModel): string {
  if (line.kind === "remove") {
    return "border-r border-rose-200 bg-rose-50 text-rose-700";
  }
  if (line.kind === "add") {
    return "border-r border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-r border-border bg-muted text-muted-foreground";
}

function getCodeRowTone(line: ChatFileOperationLineViewModel): string {
  if (line.kind === "remove") {
    return "bg-rose-50 text-rose-950";
  }
  if (line.kind === "add") {
    return "bg-emerald-50 text-emerald-950";
  }
  return "bg-card text-foreground";
}

function FileOperationLineNumberCell({
  layout,
  line,
  lineNumberColumnWidth,
  target,
  targetRef,
}: {
  layout: "compact" | "workspace";
  line: ChatFileOperationLineViewModel;
  lineNumberColumnWidth: string;
  target?: boolean;
  targetRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={targetRef}
      data-file-line-number-cell="true"
      style={layout === "compact" ? { width: lineNumberColumnWidth, minWidth: lineNumberColumnWidth } : undefined}
      className={cn(
        FILE_LINE_NUMBER_CELL_CLASS_NAME,
        layout === "compact" ? "sticky left-0 z-[1]" : "w-full shrink-0",
        getLineNumberTone(line),
        target ? "bg-gray-200 font-medium text-gray-950" : null,
      )}
    >
      {readVisibleLineNumber(line)}
    </span>
  );
}

function FileOperationCodeCell({
  language,
  line,
  target,
  targetColumn,
  targetRef,
}: {
  language: string;
  line: ChatFileOperationLineViewModel;
  target?: boolean;
  targetColumn?: number | null;
  targetRef?: Ref<HTMLSpanElement>;
}) {
  const highlightedCode = useMemo(
    () => chatCodeSyntaxHighlighter.highlight(line.text || " ", language),
    [language, line.text],
  );
  const visibleTargetColumn =
    typeof targetColumn === "number" &&
    Number.isSafeInteger(targetColumn) &&
    targetColumn > 0
      ? Math.min(targetColumn, line.text.length + 1)
      : null;

  return (
    <span
      ref={visibleTargetColumn ? undefined : targetRef}
      data-file-code-row="true"
      data-file-code-language={highlightedCode.language}
      data-highlighted={highlightedCode.highlighted ? "true" : "false"}
      data-file-target-column={visibleTargetColumn ?? undefined}
      className={cn(
        "chat-file-code-syntax hljs relative block min-w-0 flex-1 whitespace-pre px-2.5",
        readLanguageClassName(highlightedCode.language),
        getCodeRowTone(line),
        target ? "bg-gray-100/90" : null,
      )}
    >
      <span dangerouslySetInnerHTML={{ __html: highlightedCode.html }} />
      {visibleTargetColumn ? (
        <span
          ref={targetRef}
          aria-hidden="true"
          data-file-target-caret="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: `calc(0.625rem + ${visibleTargetColumn - 1}ch)` }}
        />
      ) : null}
    </span>
  );
}

function FileOperationLineRow({
  language,
  line,
  showLineNumbers,
  lineNumberColumnWidth,
}: {
  language: string;
  line: ChatFileOperationLineViewModel;
  showLineNumbers: boolean;
  lineNumberColumnWidth: string;
}) {
  return (
    <div data-file-line-row="true" className={FILE_ROW_CLASS_NAME}>
      {showLineNumbers ? (
        <FileOperationLineNumberCell
          layout="compact"
          line={line}
          lineNumberColumnWidth={lineNumberColumnWidth}
        />
      ) : null}
      <FileOperationCodeCell language={language} line={line} />
    </div>
  );
}

function FileOperationWorkspaceSurface({
  block,
  targetColumn,
  targetLine,
}: {
  block: ChatFileOperationBlockViewModel;
  targetColumn?: number | null;
  targetLine?: number | null;
}) {
  const showLineNumbers = readHasBlockLineNumbers(block);
  const lineNumberColumnWidth = readLineNumberColumnWidth(block);
  const codeColumnWidth = readCodeColumnWidth(block);
  const language = readBlockLanguage(block);
  const targetRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    targetRef.current?.scrollIntoView({
      block: "center",
      inline: targetColumn ? "center" : "nearest",
    });
  }, [block, targetColumn, targetLine]);

  return (
    <div
      data-file-code-surface="true"
      data-file-code-surface-layout="workspace"
      className="flex h-full min-h-full min-w-full bg-card"
    >
      {showLineNumbers ? (
        <div
          data-file-code-gutter="true"
          style={{
            width: lineNumberColumnWidth,
            minWidth: lineNumberColumnWidth,
          }}
          className={cn(
            "flex h-full min-h-full shrink-0 flex-col",
            FILE_TEXT_CLASS_NAME,
          )}
        >
          {block.lines.map((line, index) => (
            <FileOperationLineNumberCell
              key={readLineKey("gutter", line, index)}
              layout="workspace"
              line={line}
              lineNumberColumnWidth={lineNumberColumnWidth}
              target={isTargetLine(line, targetLine)}
              targetRef={!targetColumn && isTargetLine(line, targetLine) ? targetRef : undefined}
            />
          ))}
          <div className="min-h-0 flex-1 border-r border-border bg-muted" />
        </div>
      ) : null}

      <div
        data-file-code-canvas="true"
        className="flex h-full min-h-full min-w-0 flex-1 flex-col bg-card"
      >
        <div
          data-file-code-stack="true"
          className="min-w-full"
          style={{ minWidth: codeColumnWidth }}
        >
          {block.lines.map((line, index) => {
            const target = isTargetLine(line, targetLine);
            return (
              <div
                key={readLineKey("code", line, index)}
                data-file-code-canvas-row="true"
                data-file-target-line={target ? "true" : undefined}
                aria-current={target ? "location" : undefined}
                className={FILE_ROW_CLASS_NAME}
              >
                <FileOperationCodeCell
                  language={language}
                  line={line}
                  target={target}
                  targetColumn={target ? targetColumn : null}
                  targetRef={target && (targetColumn || !showLineNumbers) ? targetRef : undefined}
                />
              </div>
            );
          })}
        </div>
        <div className="min-h-0 flex-1 bg-card" />
      </div>
    </div>
  );
}

export function FileOperationCodeSurface({
  block,
  layout = "compact",
  targetColumn,
  targetLine,
}: {
  block: ChatFileOperationBlockViewModel;
  layout?: "compact" | "workspace";
  targetColumn?: number | null;
  targetLine?: number | null;
}) {
  if (layout === "workspace") {
    return (
      <FileOperationWorkspaceSurface
        block={block}
        targetColumn={targetColumn}
        targetLine={targetLine}
      />
    );
  }

  const showLineNumbers = readHasBlockLineNumbers(block);
  const lineNumberColumnWidth = readLineNumberColumnWidth(block);
  const codeColumnWidth = readCodeColumnWidth(block);
  const surfaceMinWidth = showLineNumbers
    ? `calc(${lineNumberColumnWidth} + ${codeColumnWidth})`
    : codeColumnWidth;
  const language = readBlockLanguage(block);

  return (
    <div
      data-file-code-surface="true"
      data-file-code-surface-layout="compact"
      className="overflow-x-auto custom-scrollbar bg-card"
    >
      <div
        data-file-code-stack="true"
        className="min-w-full"
        style={{ minWidth: surfaceMinWidth }}
      >
        {block.lines.map((line, index) => (
          <FileOperationLineRow
            key={readLineKey("row", line, index)}
            language={language}
            line={line}
            showLineNumbers={showLineNumbers}
            lineNumberColumnWidth={lineNumberColumnWidth}
          />
        ))}
      </div>
    </div>
  );
}

export function FileOperationLinesGrid({
  block,
}: {
  block: ChatFileOperationBlockViewModel;
}) {
  return <FileOperationCodeSurface block={block} layout="compact" />;
}
