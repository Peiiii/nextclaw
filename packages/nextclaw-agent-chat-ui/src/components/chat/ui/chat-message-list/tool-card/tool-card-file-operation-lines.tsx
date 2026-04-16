import type {
  ChatFileOperationBlockViewModel,
  ChatFileOperationLineViewModel,
} from "../../../view-models/chat-ui.types";
import { cn } from "../../../internal/cn";
import type { CSSProperties } from "react";

const FILE_TEXT_CLASS_NAME = "font-mono text-[11px] leading-5";
const FILE_ROW_CLASS_NAME = `h-5 ${FILE_TEXT_CLASS_NAME}`;
const FILE_LINE_NUMBER_CELL_CLASS_NAME =
  "flex h-5 items-center justify-center px-2.5 tabular-nums select-none";

function formatLineNumber(value?: number): string {
  return typeof value === "number" ? String(value) : "";
}

function readVisibleLineNumber(line: ChatFileOperationLineViewModel): string {
  return formatLineNumber(line.newLineNumber ?? line.oldLineNumber);
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

function readHasBlockLineNumbers(
  block: ChatFileOperationBlockViewModel,
): boolean {
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

function buildRowTemplateColumns(params: {
  showLineNumbers: boolean;
  lineNumberColumnWidth: string;
}): CSSProperties | undefined {
  if (!params.showLineNumbers) {
    return undefined;
  }
  return {
    gridTemplateColumns: `${params.lineNumberColumnWidth} minmax(0, 1fr)`,
  };
}

function getLineNumberTone(line: ChatFileOperationLineViewModel): string {
  if (line.kind === "remove") {
    return "border-r border-rose-200 bg-rose-50 text-rose-700";
  }
  if (line.kind === "add") {
    return "border-r border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-r border-stone-200 bg-stone-100 text-stone-500";
}

function getCodeRowTone(line: ChatFileOperationLineViewModel): string {
  if (line.kind === "remove") {
    return "bg-rose-50 text-rose-950";
  }
  if (line.kind === "add") {
    return "bg-emerald-50 text-emerald-950";
  }
  return "bg-white text-amber-950/80";
}

function FileOperationLineNumberCell({
  layout,
  line,
  lineNumberColumnWidth,
}: {
  layout: "compact" | "workspace";
  line: ChatFileOperationLineViewModel;
  lineNumberColumnWidth: string;
}) {
  const lineNumberCellClassName =
    layout === "compact"
      ? "sticky left-0 z-[1]"
      : "w-full shrink-0";

  return (
    <span
      data-file-line-number-cell="true"
      style={layout === "compact" ? { width: lineNumberColumnWidth } : undefined}
      className={cn(
        FILE_LINE_NUMBER_CELL_CLASS_NAME,
        lineNumberCellClassName,
        getLineNumberTone(line),
      )}
    >
      {readVisibleLineNumber(line)}
    </span>
  );
}

function FileOperationCodeCell({
  line,
}: {
  line: ChatFileOperationLineViewModel;
}) {
  return (
    <span
      data-file-code-row="true"
      className={cn(
        "block min-w-full whitespace-pre px-2.5",
        getCodeRowTone(line),
      )}
    >
      {line.text || " "}
    </span>
  );
}

function FileOperationLineRow({
  line,
  showLineNumbers,
  lineNumberColumnWidth,
}: {
  line: ChatFileOperationLineViewModel;
  showLineNumbers: boolean;
  lineNumberColumnWidth: string;
}) {
  return (
    <div
      data-file-line-row="true"
      className={cn("grid w-max min-w-full", FILE_ROW_CLASS_NAME)}
      style={buildRowTemplateColumns({
        showLineNumbers,
        lineNumberColumnWidth,
      })}
    >
      {showLineNumbers ? (
        <FileOperationLineNumberCell
          layout="compact"
          line={line}
          lineNumberColumnWidth={lineNumberColumnWidth}
        />
      ) : null}
      <FileOperationCodeCell line={line} />
    </div>
  );
}

function FileOperationWorkspaceSurface({
  block,
}: {
  block: ChatFileOperationBlockViewModel;
}) {
  const showLineNumbers = readHasBlockLineNumbers(block);
  const lineNumberColumnWidth = readLineNumberColumnWidth(block);

  return (
    <div
      data-file-code-surface="true"
      data-file-code-surface-layout="workspace"
      className="flex h-full min-h-full min-w-full bg-white"
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
            />
          ))}
          <div className="min-h-0 flex-1 border-r border-stone-200 bg-stone-100" />
        </div>
      ) : null}

      <div
        data-file-code-canvas="true"
        className="flex h-full min-h-full min-w-0 flex-1 flex-col bg-white"
      >
        {block.lines.map((line, index) => (
          <div
            key={readLineKey("code", line, index)}
            data-file-code-canvas-row="true"
            className={FILE_ROW_CLASS_NAME}
          >
            <FileOperationCodeCell line={line} />
          </div>
        ))}
        <div className="min-h-0 flex-1 bg-white" />
      </div>
    </div>
  );
}

export function FileOperationCodeSurface({
  block,
  layout = "compact",
}: {
  block: ChatFileOperationBlockViewModel;
  layout?: "compact" | "workspace";
}) {
  if (layout === "workspace") {
    return <FileOperationWorkspaceSurface block={block} />;
  }

  const showLineNumbers = readHasBlockLineNumbers(block);
  const lineNumberColumnWidth = readLineNumberColumnWidth(block);

  return (
    <div
      data-file-code-surface="true"
      data-file-code-surface-layout="compact"
      className="overflow-x-auto custom-scrollbar-amber bg-white"
    >
      {block.lines.map((line, index) => (
        <FileOperationLineRow
          key={readLineKey("row", line, index)}
          line={line}
          showLineNumbers={showLineNumbers}
          lineNumberColumnWidth={lineNumberColumnWidth}
        />
      ))}
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
