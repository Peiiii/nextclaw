import type {
  ChatFileOpenActionViewModel,
  ChatFileOperationBlockViewModel,
  ChatToolPartViewModel,
} from "../../../view-models/chat-ui.types";
import { cn } from "../../../internal/cn";
import { useStickyBottomScroll } from "../../../hooks/use-sticky-bottom-scroll";
import { Fragment, type ReactNode, useRef } from "react";
import { ChatUiPrimitives } from "../../primitives/chat-ui-primitives";
import { FileOperationLinesGrid } from "./tool-card-file-operation-lines";

function isPreviewBlock(block: ChatFileOperationBlockViewModel): boolean {
  return block.display === "preview";
}

function readFileOperationContentVersion(
  block: Pick<ChatFileOperationBlockViewModel, "lines" | "rawText">,
): string {
  if (block.rawText) {
    return block.rawText;
  }
  return block.lines
    .map((line) =>
      [
        line.kind,
        line.oldLineNumber ?? "",
        line.newLineNumber ?? "",
        line.text,
      ].join(":"),
    )
    .join("\n");
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
    .filter((part) => /^\+\d+$/.test(part) || /^-\d+$/.test(part));
  if (parts.length === 0) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center gap-x-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em]">
      {parts.map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          {index > 0 ? <span className="text-stone-300">·</span> : null}
          <span className={cn(getCaptionTone(part))}>{part}</span>
        </Fragment>
      ))}
    </div>
  );
}

function buildFileOpenAction(
  block: ChatFileOperationBlockViewModel,
): ChatFileOpenActionViewModel {
  return {
    path: block.path,
    label: block.path.split("/").filter(Boolean).pop() ?? block.path,
    viewMode: block.display === "diff" ? "diff" : "preview",
    ...(block.rawText ? { rawText: block.rawText } : {}),
    ...(block.beforeText ? { beforeText: block.beforeText } : {}),
    ...(block.afterText ? { afterText: block.afterText } : {}),
    ...(block.patchText ? { patchText: block.patchText } : {}),
    ...(typeof block.oldStartLine === "number"
      ? { oldStartLine: block.oldStartLine }
      : {}),
    ...(typeof block.newStartLine === "number"
      ? { newStartLine: block.newStartLine }
      : {}),
    fullLines: block.fullLines ?? block.lines,
  };
}

function StickyFileOperationScrollArea({
  children,
  contentVersion,
  resetKey,
  className,
  scrollKind,
}: {
  children: ReactNode;
  contentVersion: unknown;
  resetKey: string;
  className?: string;
  scrollKind: "block" | "raw" | "output";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useStickyBottomScroll({
    scrollRef,
    resetKey,
    isLoading: false,
    hasContent: true,
    contentVersion,
    stickyThresholdPx: 20,
  });

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      data-file-scroll-kind={scrollKind}
      className={cn(
        "overflow-y-auto bg-white custom-scrollbar-amber",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FileOperationBlock({
  block,
  showPathRow,
  isFirst,
  onFileOpen,
}: {
  block: ChatFileOperationBlockViewModel;
  showPathRow: boolean;
  isFirst: boolean;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;
  const previewBlock = isPreviewBlock(block);
  const showMetaRow = showPathRow || Boolean(block.caption);

  const handlePathClick = () => {
    if (!onFileOpen) {
      return;
    }
    onFileOpen(buildFileOpenAction(block));
  };

  return (
    <section
      className={cn(
        "overflow-hidden bg-white",
        !isFirst && "border-t border-stone-200/80",
      )}
    >
      {showMetaRow ? (
        <div
          className={cn(
            "flex items-center justify-between gap-4 border-b border-stone-200/80 px-4 text-stone-700",
            showPathRow ? "py-2" : "py-1.5",
          )}
        >
          <div className="min-w-0 flex-1">
            {showPathRow ? (
              <TooltipProvider delayDuration={250}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handlePathClick}
                      className={cn(
                        "w-full truncate whitespace-nowrap text-left font-mono text-[12px] font-medium text-stone-700",
                        onFileOpen &&
                          "transition-colors hover:text-amber-900 hover:underline",
                      )}
                      title={block.path}
                    >
                      {block.path}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-[420px] text-xs font-mono break-all"
                  >
                    {block.path}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          {block.caption ? renderCaption(block.caption) : null}
        </div>
      ) : null}

      {block.lines.length > 0 ? (
        <StickyFileOperationScrollArea
          resetKey={`block:${block.key}`}
          contentVersion={readFileOperationContentVersion(block)}
          className="max-h-72"
          scrollKind="block"
        >
          <FileOperationLinesGrid block={block} />
        </StickyFileOperationScrollArea>
      ) : block.rawText ? (
        <StickyFileOperationScrollArea
          resetKey={`raw:${block.key}`}
          contentVersion={block.rawText}
          className="max-h-72"
          scrollKind="raw"
        >
          <div className="overflow-x-auto custom-scrollbar-amber">
            <pre className="min-w-max whitespace-pre bg-white px-4 py-2 font-mono text-[11px] leading-5 text-amber-950/80">
              {block.rawText}
            </pre>
          </div>
        </StickyFileOperationScrollArea>
      ) : null}

      {block.truncated && !previewBlock ? (
        <div className="border-t border-stone-200/85 bg-stone-50 px-4 py-2 text-[10px] text-stone-500">
          Showing a shortened diff preview.
        </div>
      ) : null}
    </section>
  );
}

export function ToolCardFileOperationContent({
  card,
  className,
  onFileOpen,
}: {
  card: ChatToolPartViewModel;
  className?: string;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
}) {
  const blocks = card.fileOperation?.blocks ?? [];
  const output = card.output?.trim() ?? "";
  if (blocks.length === 0 && !output) {
    return null;
  }

  return (
    <div className={cn("overflow-hidden bg-white", className)}>
      {blocks.map((block, index) => {
        return (
          <FileOperationBlock
            key={block.key}
            block={block}
            showPathRow={true}
            isFirst={index === 0}
            onFileOpen={onFileOpen}
          />
        );
      })}

      {output ? (
        <StickyFileOperationScrollArea
          resetKey={`output:${card.toolName}:${card.summary ?? "none"}`}
          contentVersion={output}
          className={cn(
            "max-h-56",
            blocks.length > 0 && "border-t border-stone-200/80",
          )}
          scrollKind="output"
        >
          <div className="overflow-x-auto custom-scrollbar-amber">
            <pre className="min-w-max whitespace-pre bg-white px-4 py-2 font-mono text-[11px] leading-5 text-amber-950/80">
              {output}
            </pre>
          </div>
        </StickyFileOperationScrollArea>
      ) : null}
    </div>
  );
}
