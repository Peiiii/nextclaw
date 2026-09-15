import { useId, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { readFrontmatterFields } from "./utils/chat-frontmatter.utils";
import { ChatCollapsibleContent } from "./chat-collapsible-content";

export function ChatMarkdownFrontmatter({
  source,
  label,
}: {
  source: string;
  label: string;
}) {
  const fields = useMemo(() => readFrontmatterFields(source), [source]);
  const [open, setOpen] = useState(true);
  const contentId = useId();
  return (
    <div className="group/frontmatter not-prose mb-3 mt-0 overflow-hidden rounded-lg border border-border text-xs leading-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-9 w-full cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left font-medium text-muted-foreground hover:bg-[var(--interaction-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
      >
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {label}
      </button>
      <div id={contentId}>
        <ChatCollapsibleContent open={open}>
          {() => (
            <div className="max-h-80 overflow-auto border-t border-border px-3 py-2">
              {fields?.length ? (
                <dl className="m-0 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-1">
                  {fields.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="break-words text-muted-foreground">
                        {key}
                      </dt>
                      <dd className="m-0 whitespace-pre-wrap break-words text-foreground">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                  {source}
                </pre>
              )}
            </div>
          )}
        </ChatCollapsibleContent>
      </div>
    </div>
  );
}
