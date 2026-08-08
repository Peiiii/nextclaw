import type {
  ChatToolbarSelect,
  ChatToolbarSelectDiscovery,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { ChevronRight, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { matchesChatInputBarSearch } from "@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar-search.utils";

type ModelOption = ChatToolbarSelect["options"][number];

export function ChatInputBarModelDiscovery({
  discovery,
  query,
  renderOption,
}: {
  discovery: ChatToolbarSelectDiscovery;
  query: string;
  renderOption: (option: ModelOption) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [groupKey, setGroupKey] = useState("all");
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const groups = useMemo(
    () => discovery.groups.filter((group) => group.options.length > 0),
    [discovery.groups],
  );
  const resolvedGroupKey =
    groupKey === "all" || groups.some((group) => group.key === groupKey)
      ? groupKey
      : "all";
  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groups
      .filter(
        (group) => resolvedGroupKey === "all" || group.key === resolvedGroupKey,
      )
      .map((group) => ({
        ...group,
        options: normalizedQuery
          ? group.options.filter((option) =>
              matchesChatInputBarSearch(
                [option.label, option.value, option.description],
                normalizedQuery,
              ),
            )
          : group.options,
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query, resolvedGroupKey]);

  if (!groups.some((group) => group.options.length > 0)) {
    return null;
  }

  const handleSelect = async (value: string) => {
    if (pendingValue) {
      return;
    }
    setPendingValue(value);
    try {
      await discovery.onSelect(value);
    } catch {
      return;
    } finally {
      setPendingValue(null);
    }
  };

  return (
    <div className="border-t border-border/60 px-2 py-1">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate">
          {discovery.summaryLabel}
        </span>
        <span className="shrink-0 font-medium text-foreground/80">
          {discovery.viewLabel}
        </span>
      </button>
      {expanded ? (
        <div className="pb-1">
          <div
            role="tablist"
            aria-label={discovery.groupLabel}
            className="custom-scrollbar flex gap-1 overflow-x-auto overscroll-contain px-2 pb-1 pt-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={resolvedGroupKey === "all"}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${resolvedGroupKey === "all" ? "bg-foreground text-background" : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              onClick={() => setGroupKey("all")}
            >
              {discovery.allGroupLabel}
            </button>
            {groups.map((group) => (
              <button
                key={group.key}
                type="button"
                role="tab"
                aria-selected={resolvedGroupKey === group.key}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${resolvedGroupKey === group.key ? "bg-foreground text-background" : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => setGroupKey(group.key)}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div>
            {filteredGroups.map((group) => (
              <div key={group.key}>
                {resolvedGroupKey === "all" ? (
                  <div className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium text-muted-foreground/80">
                    {group.label}
                  </div>
                ) : null}
                {group.options.map((option) => (
                  <div
                    key={option.value}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--interaction-hover)]"
                  >
                    <div
                      className="min-w-0 overflow-hidden"
                      title={option.label}
                    >
                      {renderOption(option)}
                    </div>
                    <button
                      type="button"
                      disabled={pendingValue !== null}
                      className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleSelect(option.value)}
                    >
                      {pendingValue === option.value ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : null}
                      {discovery.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border/50 px-2 pt-1.5">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
              onClick={discovery.onDismiss}
            >
              {discovery.dismissLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
