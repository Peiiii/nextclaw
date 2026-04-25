import { useEffect, useId, useMemo, useRef, useState, type KeyboardEventHandler } from 'react';
import { useActiveItemScroll } from '../../hooks/use-active-item-scroll';
import type { ChatSkillPickerOption, ChatSkillPickerOptionGroup, ChatSkillPickerProps } from '../../view-models/chat-ui.types';
import { ChatUiPrimitives } from '../primitives/chat-ui-primitives';
import { BrainCircuit, Check, ExternalLink, Puzzle, Search } from 'lucide-react';

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

export function ChatInputBarSkillPicker(props: { picker: ChatSkillPickerProps }) {
  const { Input, Popover, PopoverContent, PopoverTrigger } = ChatUiPrimitives;
  const { picker } = props;
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedSet = useMemo(() => new Set(picker.selectedKeys), [picker.selectedKeys]);
  const selectedCount = picker.selectedKeys.length;
  const isSearchActive = query.trim().length > 0;
  const groupedOptions = useMemo<ChatSkillPickerOptionGroup[] | null>(() => {
    if (isSearchActive) {
      return null;
    }
    const groups = picker.groups?.filter((group) => group.options.length > 0) ?? [];
    return groups.length > 0 ? groups : null;
  }, [isSearchActive, picker.groups]);
  const visibleOptions = useMemo(() => {
    if (groupedOptions) {
      return groupedOptions.flatMap((group) => group.options);
    }
    return filterOptions(picker.options, query);
  }, [groupedOptions, picker.options, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((current) => {
      if (visibleOptions.length === 0) {
        return 0;
      }
      return Math.min(current, visibleOptions.length - 1);
    });
  }, [visibleOptions.length]);

  useActiveItemScroll({
    containerRef: listRef,
    activeIndex,
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
      setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const activeOption = visibleOptions[activeIndex];
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
          className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg px-0 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 sm:w-auto sm:gap-1.5 sm:px-3"
        >
          <BrainCircuit className="h-4 w-4" />
          <span className="hidden sm:inline">{picker.title}</span>
          {selectedCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-sm sm:static sm:ml-0.5 sm:bg-primary/10 sm:text-primary sm:shadow-none">
              {selectedCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[360px] p-0">
        <div className="space-y-2 border-b border-gray-100 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">{picker.title}</div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={picker.searchPlaceholder}
              role="combobox"
              aria-controls={listId}
              aria-expanded="true"
              aria-autocomplete="list"
              aria-activedescendant={visibleOptions[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
              className="h-8 rounded-lg pl-8 text-xs"
            />
          </div>
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="custom-scrollbar max-h-[320px] overflow-y-auto"
        >
          {picker.isLoading ? (
            <div className="p-4 text-xs text-gray-500">{picker.loadingLabel}</div>
          ) : visibleOptions.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">{picker.emptyLabel}</div>
          ) : (
            <div className="py-1">
              {(() => {
                const groups = groupedOptions ?? [{ key: 'all-skills', options: visibleOptions }];
                let visibleIndex = 0;
                return groups.map((group) => (
                  <div key={group.key}>
                    {group.label ? (
                      <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {group.label}
                      </div>
                    ) : null}
                    {group.options.map((option) => {
                      const index = visibleIndex;
                      visibleIndex += 1;
                      const isSelected = selectedSet.has(option.key);
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          id={`${listId}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          data-skill-index={index}
                          onClick={() => onToggleOption(option.key)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-gray-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                            <Puzzle className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm text-gray-900">{option.label}</span>
                              {option.badgeLabel ? (
                                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  {option.badgeLabel}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-gray-500">{option.description || option.key}</div>
                          </div>
                          <div className="ml-3 shrink-0">
                            <span
                              className={
                                isSelected
                                  ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
                                  : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white'
                              }
                            >
                              {isSelected ? <Check className="h-3 w-3" /> : null}
                            </span>
                          </div>
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
          <div className="border-t border-gray-100 px-4 py-2.5">
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
