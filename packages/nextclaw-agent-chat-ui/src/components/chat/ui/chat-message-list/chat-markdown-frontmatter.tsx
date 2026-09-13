import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { readFrontmatterFields } from "./utils/chat-frontmatter.utils";

export function ChatMarkdownFrontmatter({ source, label }: { source: string; label: string }) {
  const fields = useMemo(() => readFrontmatterFields(source), [source]);
  return (
    <details
      open
      className="group/frontmatter not-prose my-4 overflow-hidden rounded-xl border border-border text-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-muted-foreground hover:bg-[var(--interaction-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open/frontmatter:rotate-90" />
        {label}
      </summary>
      <div className="max-h-80 overflow-auto border-t border-border px-4 py-3">
        {fields?.length ? (
          <dl className="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-x-4 gap-y-3">
            {fields.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="break-words text-muted-foreground">{key}</dt>
                <dd className="m-0 whitespace-pre-wrap break-words text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs text-foreground">{source}</pre>
        )}
      </div>
    </details>
  );
}
