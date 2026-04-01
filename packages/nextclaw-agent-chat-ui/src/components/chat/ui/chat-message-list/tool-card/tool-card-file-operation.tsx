import type {
  ChatFileOperationBlockViewModel,
  ChatFileOperationLineViewModel,
  ChatToolPartViewModel,
} from "../../../view-models/chat-ui.types";
import { cn } from "../../../internal/cn";

function formatLineNumber(value?: number): string {
  return typeof value === "number" ? String(value) : "";
}

function renderDiffLine(
  line: ChatFileOperationLineViewModel,
  index: number,
) {
  const tone =
    line.kind === "add"
      ? "bg-emerald-500/10 text-emerald-800"
      : line.kind === "remove"
        ? "bg-rose-500/10 text-rose-800"
        : "text-amber-950/80";
  const marker =
    line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " ";

  return (
    <div
      key={`${line.kind}-${index}-${line.oldLineNumber ?? "x"}-${line.newLineNumber ?? "x"}`}
      className={cn(
        "grid grid-cols-[3rem_3rem_minmax(0,1fr)] gap-2 px-3 py-1 font-mono text-[11px] leading-relaxed",
        tone,
      )}
    >
      <span className="text-right tabular-nums opacity-45">
        {formatLineNumber(line.oldLineNumber)}
      </span>
      <span className="text-right tabular-nums opacity-45">
        {formatLineNumber(line.newLineNumber)}
      </span>
      <span className="min-w-0 whitespace-pre-wrap break-words">
        <span className="mr-2 inline-block w-3 select-none opacity-50">
          {marker}
        </span>
        {line.text || " "}
      </span>
    </div>
  );
}

function FileOperationBlock({
  block,
}: {
  block: ChatFileOperationBlockViewModel;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-amber-200/40 bg-white/55">
      <div className="border-b border-amber-200/30 bg-amber-100/35 px-3 py-2">
        <div className="font-mono text-[11px] text-amber-950/90 break-all">
          {block.path}
        </div>
        {block.caption ? (
          <div className="mt-1 text-[10px] text-amber-700/75">
            {block.caption}
          </div>
        ) : null}
      </div>

      {block.lines.length > 0 ? (
        <div className="max-h-72 overflow-auto custom-scrollbar-amber">
          {block.lines.map(renderDiffLine)}
        </div>
      ) : block.rawText ? (
        <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-950/80 whitespace-pre-wrap break-all custom-scrollbar-amber">
          {block.rawText}
        </pre>
      ) : null}

      {block.truncated ? (
        <div className="border-t border-amber-200/30 bg-amber-50/60 px-3 py-2 text-[10px] text-amber-700/80">
          Preview truncated for streaming performance.
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
      {blocks.map((block) => (
        <FileOperationBlock key={block.key} block={block} />
      ))}

      {output ? (
        <pre className="max-h-56 overflow-auto rounded-md border border-amber-200/35 bg-amber-100/35 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-950/80 whitespace-pre-wrap break-all custom-scrollbar-amber">
          {output}
        </pre>
      ) : null}
    </div>
  );
}
