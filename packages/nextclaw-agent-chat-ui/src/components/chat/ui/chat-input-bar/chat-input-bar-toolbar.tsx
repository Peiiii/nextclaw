import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
  createChatSelectAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type {
  ChatInputBarToolbarProps,
  ChatToolbarAccessoryIcon,
  ChatToolbarIcon,
  ChatToolbarSelect
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { Brain, Check, ChevronDown, Paperclip, Search, Sparkles, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChatInputBarActions } from './chat-input-bar-actions';
import { ChatInputBarSkillPicker } from './chat-input-bar-skill-picker';

function ToolbarIcon({ icon }: { icon?: ChatToolbarIcon }) {
  return icon === 'sparkles'
    ? <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
    : icon === 'brain'
      ? <Brain className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      : null;
}

function AccessoryIcon({ icon }: { icon?: ChatToolbarAccessoryIcon }) {
  return icon === 'paperclip' ? <Paperclip className="h-4 w-4" /> : <ToolbarIcon icon={icon} />;
}

const TRIGGER_WIDTH_BY_KEY: Record<string, string> = {
  model: 'min-w-0 max-w-[18rem]',
  'session-type': 'shrink-0',
  thinking: 'shrink-0'
};

const CONTENT_WIDTH_BY_KEY: Record<string, string> = {
  model: 'w-[min(18rem,calc(100vw-1rem))] sm:w-[320px]',
  'session-type': 'w-[220px]',
  thinking: 'w-[180px]'
};

const TOOLBAR_POPOVER_MAX_HEIGHT = createChatPopoverAvailableHeightLimit('18rem');
const TOOLBAR_SELECT_MAX_HEIGHT = createChatSelectAvailableHeightLimit('18rem');

function resolveMobileSelectedLabel(item: ChatToolbarSelect): string | undefined {
  return item.key === 'model' && item.selectedLabel
    ? item.selectedLabel.split('/').slice(1).join('/').trim() || item.selectedLabel
    : item.selectedLabel;
}

function buildSelectGroups(item: ChatToolbarSelect) {
  return item.groups?.filter((group) => group.options.length > 0) ??
    (item.options.length > 0 ? [{ key: `${item.key}-default`, options: item.options }] : []);
}

function ToolbarSelectTriggerContent({ item }: { item: ChatToolbarSelect }) {
  const mobileSelectedLabel = resolveMobileSelectedLabel(item);
  if (item.selectedLabel) {
    return (
      <div className="flex min-w-0 items-center gap-2 text-left">
        <ToolbarIcon icon={item.icon} />
        <span className="nextclaw-chat-toolbar-mobile-label truncate sm:hidden [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden">{mobileSelectedLabel}</span>
        <span className="nextclaw-chat-toolbar-label hidden truncate sm:inline [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden">{item.selectedLabel}</span>
      </div>
    );
  }
  if (item.loading) {
    return <div className="h-3 w-24 animate-pulse rounded bg-muted" />;
  }
  return <span className="truncate">{item.placeholder}</span>;
}

function ToolbarSelectOptionContent({
  option
}: {
  option: ChatToolbarSelect['options'][number];
}) {
  return option.description ? (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-xs font-semibold text-foreground">{option.label}</span>
      <span className="truncate text-[11px] text-muted-foreground">{option.description}</span>
    </div>
  ) : (
    <span className="truncate text-xs font-semibold text-foreground">{option.label}</span>
  );
}

function ToolbarSearchableSelect({ item }: { item: ChatToolbarSelect }) {
  const { Input, Popover, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
          [option.label, option.value, option.description]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedQuery)),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);
  const hasOptions = groups.some((group) => group.options.length > 0);
  const hasFilteredOptions = filteredGroups.some((group) => group.options.length > 0);
  const action = item.optionAction;
  const activeValues = new Set(action?.activeValues ?? []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={item.selectedLabel ? `${item.placeholder}: ${item.selectedLabel}` : item.placeholder}
          disabled={item.disabled}
          className={`nextclaw-chat-toolbar-select-trigger inline-flex h-8 w-auto items-center justify-between rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!basis-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!justify-center [@container_nextclaw-chat-input-bar_(max-width:440px)]:!max-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!min-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!px-0 ${TRIGGER_WIDTH_BY_KEY[item.key] ?? ''}`}
        >
          <ToolbarSelectTriggerContent item={item} />
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70 [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={`flex flex-col overflow-hidden p-2 ${CONTENT_WIDTH_BY_KEY[item.key] ?? ''}`}
        style={{ maxHeight: TOOLBAR_POPOVER_MAX_HEIGHT }}
      >
        <div className="relative mb-2 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={item.search?.placeholder ?? item.placeholder}
            className="h-8 rounded-lg pl-8 text-xs"
          />
        </div>
        {!hasOptions ? (
          item.loading ? (
            <div className="space-y-2 px-2 py-1">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          ) : item.emptyLabel ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">{item.emptyLabel}</div>
          ) : null
        ) : null}
        {hasOptions && !hasFilteredOptions ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">{item.search?.emptyLabel ?? item.emptyLabel}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filteredGroups.map((group, groupIndex) => (
            <div key={group.key} className={groupIndex > 0 ? 'border-t border-border pt-1' : undefined}>
              {group.label ? (
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{group.label}</div>
              ) : null}
              {group.options.map((option) => {
                const isSelected = item.value === option.value;
                const isActive = activeValues.has(option.value);
                const actionLabel = isActive ? action?.activeLabel : action?.inactiveLabel;
                return (
                  <div key={option.value} className="group flex items-center gap-1 rounded-md hover:bg-accent">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left"
                      onClick={() => {
                        item.onValueChange(option.value);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <ToolbarSelectOptionContent option={option} />
                      </div>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                    </button>
                    {action && actionLabel ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={actionLabel}
                              aria-pressed={isActive}
                              className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-card hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                              onClick={(event) => {
                                event.stopPropagation();
                                action.onToggle(option.value, !isActive);
                              }}
                            >
                              <Star className={`h-3.5 w-3.5 ${isActive ? 'fill-current text-foreground' : ''}`} />
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
      </PopoverContent>
    </Popover>
  );
}

function ToolbarSelect({ item }: { item: ChatToolbarSelect }) {
  if (item.search) {
    return <ToolbarSearchableSelect item={item} />;
  }
  const { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } =
    ChatUiPrimitives;
  const groups = buildSelectGroups(item);
  const hasOptions = groups.some((group) => group.options.length > 0);

  return (
    <Select value={item.value} onValueChange={item.onValueChange} disabled={item.disabled}>
      <SelectTrigger
        aria-label={item.selectedLabel ? `${item.placeholder}: ${item.selectedLabel}` : item.placeholder}
        title={item.selectedLabel}
        className={`nextclaw-chat-toolbar-select-trigger h-8 w-auto rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-accent-foreground focus:ring-0 sm:px-3 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!basis-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!justify-center [@container_nextclaw-chat-input-bar_(max-width:440px)]:!max-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!min-w-8 [@container_nextclaw-chat-input-bar_(max-width:440px)]:!px-0 ${TRIGGER_WIDTH_BY_KEY[item.key] ?? ''}`}
      >
        {item.selectedLabel || item.loading ? <ToolbarSelectTriggerContent item={item} /> : <SelectValue placeholder={item.placeholder} />}
      </SelectTrigger>
      <SelectContent
        className={CONTENT_WIDTH_BY_KEY[item.key] ?? ''}
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
            <div className="px-3 py-2 text-xs text-muted-foreground">{item.emptyLabel}</div>
          ) : null
        ) : null}
        {groups.map((group, groupIndex) => (
          <div key={group.key}>
            {groupIndex > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="py-2">
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
  accessories,
  selects,
  skillPicker,
  trailingSelects = [],
}: ChatInputBarToolbarProps) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 px-3 pb-3">
      <div className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-1 overflow-hidden">
        {skillPicker ? <ChatInputBarSkillPicker picker={skillPicker} /> : null}
        {selects.map((item) => (
          <ToolbarSelect key={item.key} item={item} />
        ))}
        {accessories?.map((item) => {
          const button = (
            <button
              type="button"
              className={`inline-flex items-center rounded-lg py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/50 ${
                item.iconOnly ? 'h-8 w-8 justify-center px-0' : 'gap-1.5 px-3'
              }`}
              onClick={item.onClick}
              disabled={item.disabled}
              aria-label={item.label}
            >
              <AccessoryIcon icon={item.icon} />
              {item.iconOnly ? null : <span>{item.label}</span>}
            </button>
          );
          if (!item.tooltip) {
            return <div key={item.key}>{button}</div>;
          }
          const trigger = item.disabled ? <span className="inline-flex">{button}</span> : button;
          return (
            <TooltipProvider key={item.key}>
              <Tooltip>
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{item.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
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
