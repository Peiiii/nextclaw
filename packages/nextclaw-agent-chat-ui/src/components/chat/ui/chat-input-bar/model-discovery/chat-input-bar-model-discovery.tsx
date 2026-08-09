import { matchesChatInputBarSearch } from "@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar-search.utils";
import { ChatUiPrimitives } from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";
import type {
  ChatToolbarSelect,
  ChatToolbarSelectDiscovery,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { LoaderCircle, Search, Sparkles } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useMemo, useState } from "react";

type ModelOption = ChatToolbarSelect["options"][number];

function filterDiscoveryGroups(
  discovery: ChatToolbarSelectDiscovery,
  groupKey: string,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return discovery.groups
    .filter((group) => group.options.length > 0)
    .filter((group) => groupKey === "all" || group.key === groupKey)
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
}

export function ChatInputBarModelDiscoveryNotice({
  discovery,
  onOpen,
}: {
  discovery: ChatToolbarSelectDiscovery;
  onOpen: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-border/60 px-1.5 py-1">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
        onClick={onOpen}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">
          {discovery.summaryLabel}
        </span>
        <span className="shrink-0 font-medium text-primary">
          {discovery.viewLabel}
        </span>
      </button>
    </div>
  );
}

export function ChatInputBarModelDiscoveryDialog({
  discovery,
  open,
  onOpenChange,
  renderOption,
  restoreFocusRef,
}: {
  discovery: ChatToolbarSelectDiscovery;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderOption: (option: ModelOption) => ReactNode;
  restoreFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
  } = ChatUiPrimitives;
  const [query, setQuery] = useState("");
  const [groupKey, setGroupKey] = useState("all");
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [addedValues, setAddedValues] = useState<Set<string>>(() => new Set());
  const groups = useMemo(
    () => discovery.groups.filter((group) => group.options.length > 0),
    [discovery.groups],
  );
  const resolvedGroupKey =
    groupKey === "all" || groups.some((group) => group.key === groupKey)
      ? groupKey
      : "all";
  const filteredGroups = useMemo(
    () => filterDiscoveryGroups(discovery, resolvedGroupKey, query),
    [discovery, query, resolvedGroupKey],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setGroupKey("all");
      setPendingValue(null);
      setAddedValues(new Set());
    }
  };
  const handleSelect = async (value: string) => {
    if (pendingValue || addedValues.has(value)) {
      return;
    }
    setPendingValue(value);
    try {
      await discovery.onSelect(value);
      setAddedValues((current) => new Set(current).add(value));
    } catch {
      return;
    } finally {
      setPendingValue(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        closeLabel={discovery.closeLabel}
        className="flex h-[calc(100vh-1rem)] max-h-[42rem] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(42rem,calc(100vh-2rem))]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusRef.current?.focus();
        }}
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="pr-8 text-lg font-semibold text-foreground">
            {discovery.groupLabel}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {discovery.summaryLabel}
          </DialogDescription>
          <div className="relative pt-3">
            <Search className="pointer-events-none absolute left-3 top-[1.375rem] h-4 w-4 text-muted-foreground/60" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={discovery.searchPlaceholder}
              className="h-9 rounded-xl border-0 bg-muted/45 pl-9 text-sm shadow-none"
            />
          </div>
          <div
            role="tablist"
            aria-label={discovery.groupLabel}
            className="custom-scrollbar flex gap-1 overflow-x-auto overscroll-contain pt-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={resolvedGroupKey === "all"}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${resolvedGroupKey === "all" ? "bg-foreground text-background" : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
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
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${resolvedGroupKey === group.key ? "bg-foreground text-background" : "bg-muted/55 text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => setGroupKey(group.key)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {filteredGroups.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {discovery.searchEmptyLabel}
            </p>
          ) : null}
          {filteredGroups.map((group) => (
            <div key={group.key}>
              {resolvedGroupKey === "all" ? (
                <div className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
                  {group.label}
                </div>
              ) : null}
              {group.options.map((option) => {
                const isAdded = addedValues.has(option.value);
                return (
                  <div
                    key={option.value}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--interaction-hover)]"
                  >
                    <div
                      className="min-w-0 overflow-hidden"
                      title={option.label}
                    >
                      {renderOption(option)}
                    </div>
                    <button
                      type="button"
                      disabled={pendingValue !== null || isAdded}
                      className="inline-flex h-8 min-w-16 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
                      onClick={() => void handleSelect(option.value)}
                    >
                      {pendingValue === option.value ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {isAdded ? discovery.addedLabel : discovery.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 px-5 py-3">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
            onClick={() => {
              discovery.onDismiss();
              handleOpenChange(false);
            }}
          >
            {discovery.dismissLabel}
          </button>
          <button
            type="button"
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background transition-opacity hover:opacity-85"
            onClick={() => handleOpenChange(false)}
          >
            {discovery.doneLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
