import type {
  ChatFileOperationBlockViewModel,
  ChatFileOperationLineViewModel,
  ChatToolPartViewModel,
} from "../../../view-models/chat-ui.types";
import { cn } from "../../../internal/cn";
import { Fragment } from "react";

function formatLineNumber(value?: number): string {
  return typeof value === "number" ? String(value) : "";
}

function isPreviewBlock(block: ChatFileOperationBlockViewModel): boolean {
  return block.display === "preview";
}

function getCaptionTone(part: string): string {
  if (/^\+\d+$/.test(part)) {
    return "text-emerald-700";
  }
  if (/^-\d+$/.test(part)) {
    return "text-rose-700";
  }
  return "text-stone-500";
}

function renderCaption(caption: string) {
  const parts = caption
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? (
            <span className="text-stone-300">·</span>
          ) : null}
          <span className={cn(getCaptionTone(part))}>
            {part}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function renderDiffGutterRow(
  line: ChatFileOperationLineViewModel,
  index: number,
) {
  const gutterTone =
    line.kind === "add"
      ? "border-r border-emerald-200 bg-emerald-100 text-emerald-700"
      : line.kind === "remove"
        ? "border-r border-rose-200 bg-rose-100 text-rose-700"
        : "border-r border-stone-200 bg-stone-100 text-stone-500";

  return (
    <div
      key={`diff-gutter-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`}
      className="grid grid-cols-[3.25rem_3.25rem] font-mono text-[11px] leading-relaxed"
    >
      <span className={cn("px-2 py-1 text-right tabular-nums", gutterTone)}>
        {formatLineNumber(line.oldLineNumber)}
      </span>
      <span className={cn("px-2 py-1 text-right tabular-nums", gutterTone)}>
        {formatLineNumber(line.newLineNumber)}
      </span>
    </div>
  );
}

function renderPreviewGutterRow(
  line: ChatFileOperationLineViewModel,
  index: number,
) {
  return (
    <div
      key={`preview-gutter-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`}
      className="font-mono text-[11px] leading-relaxed"
    >
      <span className="block w-[3.25rem] border-r border-stone-200 bg-stone-100 px-2 py-1.5 text-right tabular-nums text-stone-500">
        {formatLineNumber(line.newLineNumber ?? line.oldLineNumber)}
      </span>
    </div>
  );
}

function renderDiffCodeRow(
  line: ChatFileOperationLineViewModel,
  index: number,
) {
  const rowTone =
    line.kind === "add"
      ? "border-l-2 border-emerald-300 bg-emerald-50 text-emerald-950"
      : line.kind === "remove"
        ? "border-l-2 border-rose-300 bg-rose-50 text-rose-950"
        : "border-l-2 border-transparent text-amber-950/80";

  return (
    <div
      key={`diff-code-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`}
      className={cn(
        "min-w-full whitespace-pre px-3 py-1 font-mono text-[11px] leading-relaxed",
        rowTone,
      )}
    >
      {line.text || " "}
    </div>
  );
}

function renderPreviewCodeRow(
  line: ChatFileOperationLineViewModel,
  index: number,
) {
  return (
    <div
      key={`preview-code-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`}
      className="min-w-full whitespace-pre px-3 py-1.5 font-mono text-[11px] leading-relaxed text-amber-950/85"
    >
      {line.text || " "}
    </div>
  );
}

function FileOperationBlock({
  block,
  showPathHeader,
}: {
  block: ChatFileOperationBlockViewModel;
  showPathHeader: boolean;
}) {
  const previewBlock = isPreviewBlock(block);
  const showMetaRow = showPathHeader || Boolean(block.caption);

  return (
    <section className="overflow-hidden rounded-lg border border-stone-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
      {showMetaRow ? (
        <div
          className={cn(
            "px-3 text-stone-700",
            showPathHeader
              ? "border-b border-stone-200/80 bg-stone-50/90 py-2"
              : "bg-transparent pt-2 pb-1",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {showPathHeader ? (
              <div className="font-mono text-[11px] font-medium break-all text-stone-700">
                {block.path}
              </div>
            ) : null}
            {block.caption ? renderCaption(block.caption) : null}
          </div>
        </div>
      ) : null}

      {block.lines.length > 0 ? (
        <div className="max-h-72 overflow-auto bg-white custom-scrollbar-amber">
          <div
            className={cn(
              "grid min-w-0 max-w-full",
              previewBlock ? "grid-cols-[3.25rem_minmax(0,1fr)]" : "grid-cols-[6.5rem_minmax(0,1fr)]",
            )}
          >
            <div className="overflow-hidden">
              {block.lines.map(previewBlock ? renderPreviewGutterRow : renderDiffGutterRow)}
            </div>
            <div className="overflow-x-auto custom-scrollbar-amber">
              <div className="min-w-max">
                {block.lines.map(previewBlock ? renderPreviewCodeRow : renderDiffCodeRow)}
              </div>
            </div>
          </div>
        </div>
      ) : block.rawText ? (
        <pre className="max-h-72 min-w-full w-max overflow-auto bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-950/80 whitespace-pre custom-scrollbar-amber">
          {block.rawText}
        </pre>
      ) : null}

      {block.truncated && !previewBlock ? (
        <div className="border-t border-stone-200/80 bg-stone-50 px-3 py-2 text-[10px] text-stone-500">
          Showing a shortened diff preview.
        </div>
      ) : null}
    </section>
  );
}

export function ToolCardFileOperationContent({
  card,
  className,
}: {
  card: ChatToolPartViewModel;
  className?: string;
}) {
  const blocks = card.fileOperation?.blocks ?? [];
  const output = card.output?.trim() ?? "";
  if (blocks.length === 0 && !output) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block) => {
        const hidePathHeader =
          blocks.length === 1 &&
          typeof card.summary === "string" &&
          card.summary.trim() === block.path;
        return (
          <FileOperationBlock
            key={block.key}
            block={block}
            showPathHeader={!hidePathHeader}
          />
        );
      })}

      {output ? (
        <pre className="max-h-56 min-w-full w-max overflow-auto rounded-md border border-amber-200/35 bg-amber-100/35 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-950/80 whitespace-pre custom-scrollbar-amber">
          {output}
        </pre>
      ) : null}
    </div>
  );
}
