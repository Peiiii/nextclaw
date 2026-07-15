import { useId, useMemo, useRef, useState, type KeyboardEventHandler } from 'react';
import { BrainCircuit, Check, ExternalLink, Puzzle, Search } from 'lucide-react';
import { useActiveItemScroll } from '@agent-chat-ui/components/chat/hooks/use-active-item-scroll';
import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type { ChatSkillPickerOption, ChatSkillPickerOptionGroup, ChatSkillPickerProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

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

const SKILL_PICKER_HEIGHT = createChatPopoverAvailableHeightLimit('20rem');

export function ChatInputBarSkillPicker(props: { picker: ChatSkillPickerProps }) {
  const { Input, Popover, PopoverContent, PopoverTrigger } = ChatUiPrimitives;
  const { picker } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedSet = useMemo(() => new Set(picker.selectedKeys), [picker.selectedKeys]);
  const selectedCount = picker.selectedKeys.length;
  const availableGroups = useMemo(
    () => picker.groups?.filter((group) => group.options.length > 0) ?? [],
    [picker.groups],
  );
  const resolvedActiveGroupKey = availableGroups.some((group) => group.key === activeGroupKey)
    ? activeGroupKey
    : null;
  const groupedOptions = useMemo<ChatSkillPickerOptionGroup[] | null>(() => {
    if (availableGroups.length === 0) {
      return null;
    }
    const groups = resolvedActiveGroupKey
      ? availableGroups.filter((group) => group.key === resolvedActiveGroupKey)
      : availableGroups;
    return groups
      .map((group) => ({
        ...group,
        options: filterOptions(group.options, query),
      }))
      .filter((group) => group.options.length > 0);
  }, [availableGroups, query, resolvedActiveGroupKey]);
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-label={picker.title}
          className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg px-0 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <BrainCircuit className="h-4 w-4" />
          <span className="nextclaw-chat-skill-picker-label hidden sm:inline [@container_nextclaw-chat-input-bar_(max-width:440px)]:hidden">
            {picker.title}
          </span>
          {selectedCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-sm sm:static sm:ml-0.5 sm:bg-primary/10 sm:text-primary sm:shadow-none">
              {selectedCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="flex w-[min(360px,calc(100vw-1rem))] flex-col overflow-hidden p-0"
        style={{ height: SKILL_PICKER_HEIGHT }}
      >
        <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-foreground">{picker.title}</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/70" />
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
              className="h-8 rounded-lg pl-8 text-xs"
            />
          </div>
          {availableGroups.length > 0 ? (
            <div className="flex flex-wrap gap-1" aria-label={picker.allGroupsLabel}>
              {[
                { key: null, label: picker.allGroupsLabel, count: picker.options.length },
                ...availableGroups.map((group) => ({
                  key: group.key,
                  label: group.label || group.key,
                  count: group.options.length,
                })),
              ].map((group) => {
                const isActive = group.key === resolvedActiveGroupKey;
                return (
                  <button
                    key={group.key ?? 'all-skills'}
                    type="button"
                    aria-pressed={isActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setActiveGroupKey(group.key);
                      setActiveIndex(0);
                    }}
                    className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{group.label}</span>
                    <span className="opacity-70">{group.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {picker.isLoading ? (
            <div className="p-4 text-xs text-muted-foreground">{picker.loadingLabel}</div>
          ) : visibleOptions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">{picker.emptyLabel}</div>
          ) : (
            <div className="py-1">
              {(() => {
                const groups = groupedOptions ?? [{ key: 'all-skills', options: visibleOptions }];
                let visibleIndex = 0;
                return groups.map((group) => (
                  <div key={group.key}>
                    {group.label ? (
                      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </div>
                    ) : null}
                    {group.options.map((option) => {
                      const index = visibleIndex;
                      visibleIndex += 1;
                      const isSelected = selectedSet.has(option.key);
                      const isActive = index === resolvedActiveIndex;
                      return (
                        <div
                          key={option.key}
                          id={`${listId}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          data-skill-index={index}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-accent' : 'hover:bg-accent'
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Puzzle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 select-text">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm text-foreground">{option.label}</span>
                              {option.badgeLabel ? (
                                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  {option.badgeLabel}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">{option.description || option.key}</div>
                          </div>
                          <div className="ml-3 shrink-0">
                            <button
                              type="button"
                              aria-label={`${isSelected ? 'Remove' : 'Add'} ${option.label}`}
                              onClick={() => onToggleOption(option.key)}
                              className={
                                isSelected
                                  ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
                                  : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card'
                              }
                            >
                              {isSelected ? <Check className="h-3 w-3" /> : null}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {picker.manageHref && picker.manageLabel ? (
          <div className="shrink-0 border-t border-border px-4 py-2.5">
            <a
              href={picker.manageHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              {picker.manageLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
