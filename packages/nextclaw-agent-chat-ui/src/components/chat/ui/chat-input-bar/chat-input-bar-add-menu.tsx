import { useId, useMemo, useRef, useState, type KeyboardEventHandler } from 'react';
import { Check, ChevronLeft, ChevronRight, ExternalLink, Paperclip, Plus, Puzzle, Search } from 'lucide-react';
import { useActiveItemScroll } from '@agent-chat-ui/components/chat/hooks/use-active-item-scroll';
import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type {
  ChatSkillPickerOption,
  ChatSkillPickerOptionGroup,
  ChatSkillPickerProps,
  ChatToolbarAccessory,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

function filterOptions(options: ChatSkillPickerOption[], query: string): ChatSkillPickerOption[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return options;
  }
  return options.filter((option) => {
    const haystack = [option.label, option.key, option.description]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

const ADD_MENU_MAX_HEIGHT = createChatPopoverAvailableHeightLimit('20rem');
const ADD_MENU_ACTION_CLASS_NAME = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50';

function ChatInputBarSkillPickerContent(props: { onBack: () => void; picker: ChatSkillPickerProps }) {
  const { Input } = ChatUiPrimitives;
  const { onBack, picker } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedSet = useMemo(() => new Set(picker.selectedKeys), [picker.selectedKeys]);
  const availableGroups = useMemo(
    () => picker.groups?.filter((group) => group.options.length > 0) ?? [],
    [picker.groups],
  );
  const groupedOptions = useMemo<ChatSkillPickerOptionGroup[] | null>(() => {
    if (availableGroups.length === 0) {
      return null;
    }
    return availableGroups
      .map((group) => ({
        ...group,
        options: filterOptions(group.options, query),
      }))
      .filter((group) => group.options.length > 0);
  }, [availableGroups, query]);
  const visibleOptions = useMemo(() => {
    if (groupedOptions !== null) {
      return groupedOptions.flatMap((group) => group.options);
    }
    return filterOptions(picker.options, query);
  }, [groupedOptions, picker.options, query]);
  const resolvedActiveIndex = visibleOptions.length === 0
    ? 0
    : Math.min(activeIndex, visibleOptions.length - 1);

  useActiveItemScroll({
    containerRef: listRef,
    activeIndex: resolvedActiveIndex,
    itemCount: visibleOptions.length,
    isEnabled: visibleOptions.length > 0,
    getItemSelector: (index) => `[data-skill-index="${index}"]`
  });

  const onToggleOption = (optionKey: string) => {
    if (selectedSet.has(optionKey)) {
      picker.onSelectedKeysChange(picker.selectedKeys.filter((item) => item !== optionKey));
      return;
    }
    picker.onSelectedKeysChange([...picker.selectedKeys, optionKey]);
  };

  const onSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (visibleOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(Math.min(resolvedActiveIndex + 1, visibleOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(resolvedActiveIndex - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const activeOption = visibleOptions[resolvedActiveIndex];
      if (activeOption) {
        onToggleOption(activeOption.key);
      }
    }
  };

  return (
    <>
      <div className="shrink-0 space-y-1.5 p-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-7 items-center gap-1 rounded-md pr-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--interaction-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{picker.title}</span>
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={picker.searchPlaceholder}
            role="combobox"
            aria-controls={listId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={visibleOptions[resolvedActiveIndex]
              ? `${listId}-option-${resolvedActiveIndex}`
              : undefined}
            className="h-8 rounded-lg border-0 bg-muted/45 pl-7 text-xs shadow-none"
          />
        </div>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1"
      >
        {picker.isLoading ? (
          <div className="p-4 text-xs text-muted-foreground">{picker.loadingLabel}</div>
        ) : visibleOptions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">{picker.emptyLabel}</div>
        ) : (
          <div>
            {(() => {
              const groups = groupedOptions ?? [{ key: 'all-skills', options: visibleOptions }];
              let visibleIndex = 0;
              return groups.map((group) => (
                <div key={group.key}>
                  {group.label ? (
                    <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground/80">
                      {group.label}
                    </div>
                  ) : null}
                  {group.options.map((option) => {
                    const index = visibleIndex;
                    visibleIndex += 1;
                    const isSelected = selectedSet.has(option.key);
                    const isActive = index === resolvedActiveIndex;
                    return (
                      <button
                        type="button"
                        key={option.key}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={option.label}
                        data-skill-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => onToggleOption(option.key)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                          isActive ? 'bg-[var(--interaction-hover)]' : 'hover:bg-[var(--interaction-hover)]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-foreground">{option.label}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{option.description || option.key}</div>
                        </div>
                        {isSelected ? <Check className="h-4 w-4 shrink-0 text-foreground/70" /> : null}
                      </button>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {picker.manageHref && picker.manageLabel ? (
        <div className="shrink-0 px-2 pb-2 pt-1">
          <a
            href={picker.manageHref}
            className="inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground"
          >
            {picker.manageLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </>
  );
}

export function ChatInputBarAddMenu(props: {
  accessories: ChatToolbarAccessory[];
  label: string;
  picker?: ChatSkillPickerProps | null;
}) {
  const { Popover, PopoverContent, PopoverTrigger, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;
  const { accessories, label, picker } = props;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'actions' | 'skills'>('actions');

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setView('actions');
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={label}
                  className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </PopoverTrigger>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        side="top"
        align="start"
        className={view === 'skills'
          ? 'flex w-[min(340px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border-border/80 p-0 shadow-md'
          : 'w-[min(220px,calc(100vw-1rem))] rounded-xl border-border/80 p-1.5 shadow-md'}
        style={{ maxHeight: ADD_MENU_MAX_HEIGHT }}
      >
        {view === 'actions' ? (
          <>
            {accessories.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={ADD_MENU_ACTION_CLASS_NAME}
              >
                {item.icon === 'paperclip' ? <Paperclip className="h-4 w-4" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            ))}
            {picker ? (
              <button
                type="button"
                onClick={() => setView('skills')}
                className={ADD_MENU_ACTION_CLASS_NAME}
              >
                <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{picker.title}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </button>
            ) : null}
          </>
        ) : picker ? (
          <ChatInputBarSkillPickerContent picker={picker} onBack={() => setView('actions')} />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
