import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
  createChatSelectAvailableHeightLimit,
} from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";
import type {
  ChatInputBarToolbarProps,
  ChatToolbarIcon,
  ChatToolbarSelect,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import {
  Brain,
  Check,
  ChevronDown,
  ExternalLink,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ChatInputBarActions } from "./chat-input-bar-actions";
import { ChatInputBarAddMenu } from "./chat-input-bar-add-menu";
import { matchesChatInputBarSearch } from "./chat-input-bar-search.utils";
import { ChatInputBarModelDiscovery } from "./model-discovery/chat-input-bar-model-discovery";

function ToolbarIcon({
  icon,
  className = "",
}: {
  icon?: ChatToolbarIcon;
  className?: string;
}) {
  return icon === "sparkles" ? (
    <Sparkles className={`h-3.5 w-3.5 shrink-0 text-primary ${className}`} />
  ) : icon === "brain" ? (
    <Brain
      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground ${className}`}
    />
  ) : null;
}

const TRIGGER_WIDTH_BY_KEY: Record<string, string> = {
  model: "min-w-0 max-w-[18rem]",
  "session-type": "shrink-0",
  thinking: "shrink-0",
};

const CONTENT_WIDTH_BY_KEY: Record<string, string> = {
  model: "w-[min(340px,calc(100vw-1rem))]",
  "session-type": "w-[220px]",
  thinking: "w-[180px]",
};

const TOOLBAR_POPOVER_MAX_HEIGHT =
  createChatPopoverAvailableHeightLimit("18rem");
const TOOLBAR_SELECT_MAX_HEIGHT = createChatSelectAvailableHeightLimit("18rem");

function resolveSelectedTriggerLabel(
  item: ChatToolbarSelect,
): string | undefined {
  return item.key === "model" && item.selectedLabel
    ? item.selectedLabel.split("/").slice(1).join("/").trim() ||
        item.selectedLabel
    : item.selectedLabel;
}

function buildSelectGroups(item: ChatToolbarSelect) {
  return (
    item.groups?.filter((group) => group.options.length > 0) ??
    (item.options.length > 0
      ? [{ key: `${item.key}-default`, options: item.options }]
      : [])
  );
}

function ToolbarSelectTriggerContent({ item }: { item: ChatToolbarSelect }) {
  const selectedTriggerLabel = resolveSelectedTriggerLabel(item);
  if (item.selectedLabel) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-left">
        <ToolbarIcon
          icon={item.icon}
          className={
            item.key === "model"
              ? "hidden [@container_nextclaw-chat-input-bar_(max-width:440px)]:block"
              : undefined
          }
        />
        <span className="nextclaw-chat-toolbar-mobile-label truncate sm:hidden [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden">
          {selectedTriggerLabel}
        </span>
        <span className="nextclaw-chat-toolbar-label hidden truncate sm:inline [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden">
          {selectedTriggerLabel}
        </span>
      </div>
    );
  }
  if (item.loading) {
    return <div className="h-3 w-24 animate-pulse rounded bg-muted" />;
  }
  return <span className="truncate">{item.placeholder}</span>;
}

function ToolbarSelectOptionContent({
  option,
}: {
  option: ChatToolbarSelect["options"][number];
}) {
  return option.description ? (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="block truncate text-sm font-normal text-foreground">
        {option.label}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground">
        {option.description}
      </span>
    </div>
  ) : (
    <span className="block truncate text-sm font-normal text-foreground">
      {option.label}
    </span>
  );
}

function ToolbarSearchableSelect({ item }: { item: ChatToolbarSelect }) {
  const {
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } = ChatUiPrimitives;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const groups = buildSelectGroups(item);
  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          matchesChatInputBarSearch(
            [option.label, option.value, option.description],
            normalizedQuery,
          ),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);
  const hasOptions = groups.some((group) => group.options.length > 0);
  const hasFilteredOptions = filteredGroups.some(
    (group) => group.options.length > 0,
  );
  const { discovery, optionAction: action } = item;
  const activeValues = new Set(action?.activeValues ?? []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      item.onOpen?.();
      return;
    }
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            item.selectedLabel
              ? `${item.placeholder}: ${item.selectedLabel}`
              : item.placeholder
          }
          disabled={item.disabled}
          className={`nextclaw-chat-toolbar-select-trigger inline-flex h-8 w-auto items-center justify-between rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!basis-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!justify-center [@container_nextclaw-chat-input-bar_(max-width:440px)]:!max-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!min-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!px-0 ${TRIGGER_WIDTH_BY_KEY[item.key] ?? ""}`}
        >
          <ToolbarSelectTriggerContent item={item} />
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70 [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={`flex flex-col overflow-hidden rounded-2xl border-border/80 p-0 shadow-md ${CONTENT_WIDTH_BY_KEY[item.key] ?? ""}`}
        style={{ maxHeight: TOOLBAR_POPOVER_MAX_HEIGHT }}
      >
        <div className="relative shrink-0 p-2 pb-1.5">
          <Search className="pointer-events-none absolute left-[18px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={item.search?.placeholder ?? item.placeholder}
            className="h-7 rounded-lg border-transparent bg-muted/45 pl-7 text-xs shadow-none focus:border-border"
          />
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!hasOptions ? (
            item.loading ? (
              <div className="space-y-2 px-2 py-1">
                <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              </div>
            ) : item.emptyLabel ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                {item.emptyLabel}
              </div>
            ) : null
          ) : null}
          {hasOptions && !hasFilteredOptions ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {item.search?.emptyLabel ?? item.emptyLabel}
            </div>
          ) : null}
          <div className="px-1.5 pb-1">
            {filteredGroups.map((group) => (
              <div key={group.key}>
                {group.label ? (
                  <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground/80">
                    {group.label}
                  </div>
                ) : null}
                {group.options.map((option) => {
                  const isSelected = item.value === option.value;
                  const isActive = activeValues.has(option.value);
                  const actionLabel = isActive
                    ? action?.activeLabel
                    : action?.inactiveLabel;
                  return (
                    <div
                      key={option.value}
                      className="group flex items-center gap-1 rounded-lg hover:bg-[var(--interaction-hover)]"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left leading-4"
                        onClick={() => {
                          item.onValueChange(option.value);
                          handleOpenChange(false);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <ToolbarSelectOptionContent option={option} />
                        </div>
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-foreground/70" />
                        ) : null}
                      </button>
                      {action && actionLabel ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={actionLabel}
                                aria-pressed={isActive}
                                className={`mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-[background-color,color,opacity] hover:bg-card hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 ${isActive ? "" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  action.onToggle(option.value, !isActive);
                                }}
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${isActive ? "fill-current text-foreground" : ""}`}
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">{actionLabel}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {discovery ? (
            <ChatInputBarModelDiscovery
              discovery={discovery}
              query={query}
              renderOption={(option) => (
                <ToolbarSelectOptionContent option={option} />
              )}
            />
          ) : null}
        </div>
        {item.manageHref && item.manageLabel ? (
          <div className="shrink-0 px-2 pb-2 pt-1">
            <a
              href={item.manageHref}
              className="inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
            >
              {item.manageLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function ToolbarSelect({ item }: { item: ChatToolbarSelect }) {
  if (item.search) {
    return <ToolbarSearchableSelect item={item} />;
  }
  const {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
  } = ChatUiPrimitives;
  const groups = buildSelectGroups(item);
  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <Select
      value={item.value}
      onValueChange={item.onValueChange}
      disabled={item.disabled}
    >
      <SelectTrigger
        aria-label={
          item.selectedLabel
            ? `${item.placeholder}: ${item.selectedLabel}`
            : item.placeholder
        }
        title={item.selectedLabel}
        className={`nextclaw-chat-toolbar-select-trigger h-8 w-auto rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus:ring-0 sm:px-3 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!basis-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!justify-center [@container_nextclaw-chat-input-bar_(max-width:440px)]:!max-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!min-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!px-0 ${TRIGGER_WIDTH_BY_KEY[item.key] ?? ""}`}
      >
        {item.selectedLabel || item.loading ? (
          <ToolbarSelectTriggerContent item={item} />
        ) : (
          <SelectValue placeholder={item.placeholder} />
        )}
      </SelectTrigger>
      <SelectContent
        className={CONTENT_WIDTH_BY_KEY[item.key] ?? ""}
        style={{ maxHeight: TOOLBAR_SELECT_MAX_HEIGHT }}
      >
        {!hasOptions ? (
          item.loading ? (
            <div className="space-y-2 px-3 py-2">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ) : item.emptyLabel ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {item.emptyLabel}
            </div>
          ) : null
        ) : null}
        {groups.map((group, groupIndex) => (
          <div key={group.key}>
            {groupIndex > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="py-1.5"
                >
                  <ToolbarSelectOptionContent option={option} />
                </SelectItem>
              ))}
            </SelectGroup>
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChatInputBarToolbar({
  actions,
  accessories = [],
  addMenuLabel,
  selects,
  skillPicker,
  trailingSelects = [],
}: ChatInputBarToolbarProps) {
  const resolvedAddMenuLabel =
    addMenuLabel ?? skillPicker?.title ?? accessories[0]?.label;
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-3 pb-3">
      <div className="nextclaw-chat-toolbar-leading-controls flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden">
        {resolvedAddMenuLabel ? (
          <ChatInputBarAddMenu
            label={resolvedAddMenuLabel}
            accessories={accessories}
            picker={skillPicker}
          />
        ) : null}
        {selects.map((item) => (
          <ToolbarSelect key={item.key} item={item} />
        ))}
      </div>
      <div className="flex shrink-0 items-end gap-1">
        {trailingSelects.length > 0 ? (
          <div className="nextclaw-chat-toolbar-trailing-selects flex min-w-0 items-center gap-1">
            {trailingSelects.map((item) => (
              <ToolbarSelect key={item.key} item={item} />
            ))}
          </div>
        ) : null}
        <ChatInputBarActions {...actions} />
      </div>
    </div>
  );
}
