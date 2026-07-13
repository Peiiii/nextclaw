import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useActiveItemScroll } from '@agent-chat-ui/components/chat/hooks/use-active-item-scroll';
import { useElementWidth } from '@agent-chat-ui/components/chat/hooks/use-element-width';
import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type {
  ChatInputSurfaceFilterOption,
  ChatInputSurfaceItem,
  ChatInputSurfaceMenuProps,
} from '@agent-chat-ui/lib/input-surface';

const INPUT_SURFACE_PANEL_MAX_WIDTH = 680;
const INPUT_SURFACE_PANEL_DESKTOP_SHRINK_RATIO = 0.82;
const INPUT_SURFACE_PANEL_DESKTOP_MIN_WIDTH = 560;
const INPUT_SURFACE_PANEL_MAX_HEIGHT = createChatPopoverAvailableHeightLimit('24rem');
const INPUT_SURFACE_PANEL_MIN_HEIGHT = createChatPopoverAvailableHeightLimit('240px');

export type ChatInputSurfaceMenuHandle = {
  handleKeyDown: (event: KeyboardEvent) => boolean;
};

type ChatInputSurfaceActiveState = {
  index: number;
  itemsSignature: string;
};

type ChatInputSurfaceFilterView = ChatInputSurfaceFilterOption & {
  count: number;
};

function itemMatchesFilter(item: ChatInputSurfaceItem, filter: ChatInputSurfaceFilterOption): boolean {
  if (!filter.sectionKeys || filter.sectionKeys.length === 0) {
    return true;
  }
  return Boolean(item.sectionKey && filter.sectionKeys.includes(item.sectionKey));
}

export const ChatInputSurfaceMenu = forwardRef<ChatInputSurfaceMenuHandle, ChatInputSurfaceMenuProps>(
function ChatInputSurfaceMenu(props, ref) {
  const { Popover, PopoverAnchor, PopoverContent } = ChatUiPrimitives;
  const { elementRef: anchorRef, width: panelWidth } = useElementWidth<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeState, setActiveState] = useState<ChatInputSurfaceActiveState>({
    index: 0,
    itemsSignature: '',
  });
  const {
    isOpen,
    isLoading,
    filterOptions,
    items,
    texts,
    onSelectItem,
    onOpenChange,
    onDetailsPointerDown,
  } = props;
  const firstFilterKey = filterOptions?.[0]?.key ?? null;
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(firstFilterKey);
  const resolvedActiveFilterKey = useMemo(() => {
    if (!filterOptions?.length) {
      return null;
    }
    return filterOptions.some((filter) => filter.key === activeFilterKey)
      ? activeFilterKey
      : filterOptions[0].key;
  }, [activeFilterKey, filterOptions]);
  const activeFilter = useMemo(
    () => filterOptions?.find((filter) => filter.key === resolvedActiveFilterKey) ?? null,
    [filterOptions, resolvedActiveFilterKey],
  );
  const filterViews = useMemo<ChatInputSurfaceFilterView[]>(
    () =>
      filterOptions?.map((filter) => ({
        ...filter,
        count: items.filter((item) => itemMatchesFilter(item, filter)).length,
      })) ?? [],
    [filterOptions, items],
  );
  const visibleItems = useMemo(
    () => (activeFilter ? items.filter((item) => itemMatchesFilter(item, activeFilter)) : items),
    [activeFilter, items],
  );
  const itemsSignature = useMemo(
    () => visibleItems.map((item) => item.key).join('\u001f'),
    [visibleItems],
  );
  const hasItemSections = useMemo(
    () => visibleItems.some((item) => Boolean(item.sectionLabel?.trim())),
    [visibleItems],
  );
  const activeIndex = activeState.itemsSignature === itemsSignature ? activeState.index : 0;
  const activeIndexInRange = visibleItems.length === 0 ? 0 : Math.min(activeIndex, visibleItems.length - 1);
  const activeItem = visibleItems[activeIndexInRange] ?? null;
  const handleFilterSelect = useCallback((filterKey: string): void => {
    setActiveFilterKey(filterKey);
    setActiveState({ index: 0, itemsSignature: '' });
  }, []);
  const setActiveIndexForCurrentItems = useCallback(
    (nextIndex: number | ((currentIndex: number) => number)): void => {
      setActiveState((currentState) => {
        const currentIndex = currentState.itemsSignature === itemsSignature ? currentState.index : 0;
        return {
          index: typeof nextIndex === 'function' ? nextIndex(currentIndex) : nextIndex,
          itemsSignature,
        };
      });
    },
    [itemsSignature],
  );

  const resolvedWidth = useMemo(() => {
    if (!panelWidth) {
      return undefined;
    }
    return Math.min(
      panelWidth > INPUT_SURFACE_PANEL_DESKTOP_MIN_WIDTH
        ? panelWidth * INPUT_SURFACE_PANEL_DESKTOP_SHRINK_RATIO
        : panelWidth,
      INPUT_SURFACE_PANEL_MAX_WIDTH,
    );
  }, [panelWidth]);

  useImperativeHandle(ref, () => ({
    handleKeyDown: (event) => {
      if (!isOpen) {
        return false;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return true;
      }

      if (visibleItems.length === 0) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndexForCurrentItems((index) => (index + 1) % visibleItems.length);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndexForCurrentItems((index) => (index - 1 + visibleItems.length) % visibleItems.length);
        return true;
      }

      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        onSelectItem(visibleItems[activeIndexInRange]);
        return true;
      }

      return false;
    },
  }), [activeIndexInRange, isOpen, onOpenChange, onSelectItem, setActiveIndexForCurrentItems, visibleItems]);

  useActiveItemScroll({
    containerRef: listRef,
    activeIndex: activeIndexInRange,
    itemCount: visibleItems.length,
    isEnabled: isOpen && !isLoading,
    getItemSelector: (index) => `[data-input-surface-index="${index}"]`,
  });

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="pointer-events-none absolute bottom-0 left-3 right-3 top-0" />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="z-[70] flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 p-0 shadow-2xl backdrop-blur-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        style={{
          maxHeight: INPUT_SURFACE_PANEL_MAX_HEIGHT,
          width: resolvedWidth ? `${resolvedWidth}px` : undefined,
        }}
      >
        <div
          className="grid min-h-0 flex-1 grid-cols-[minmax(220px,300px)_minmax(0,1fr)]"
          style={{ minHeight: INPUT_SURFACE_PANEL_MIN_HEIGHT }}
        >
          <div className="flex min-h-0 flex-col border-r border-gray-200">
            {!isLoading && filterViews.length > 0 ? (
              <div className="flex shrink-0 gap-0.5 overflow-x-auto px-2 pb-1.5 pt-2">
                {filterViews.map(({ count, key, label }) => {
                  const isActive = key === resolvedActiveFilterKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => handleFilterSelect(key)}
                      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={isActive ? 'text-gray-500' : 'text-gray-400'}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div
              ref={listRef}
              role="listbox"
              aria-label={texts.sectionLabel}
              className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain ${
                !isLoading && filterViews.length > 0 ? 'px-2 pb-2' : 'p-2'
              }`}
            >
              {isLoading ? (
                <div className="p-2 text-xs text-gray-500">{texts.loadingLabel}</div>
              ) : (
                <>
                  {!hasItemSections ? (
                    <div className="mb-1 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {texts.sectionLabel}
                    </div>
                  ) : null}
                  {visibleItems.length === 0 ? (
                    <div className="px-1.5 text-xs text-gray-400">{texts.emptyLabel}</div>
                  ) : (
                    <div>
                      {visibleItems.map((item, index) => {
                        const { key, sectionKey, sectionLabel, title, subtitle } = item;
                        const isActive = index === activeIndexInRange;
                        const previousItem = visibleItems[index - 1];
                        const shouldShowSection =
                          hasItemSections &&
                          Boolean(sectionLabel?.trim()) &&
                          previousItem?.sectionKey !== sectionKey;
                        return (
                          <div key={key}>
                            {shouldShowSection ? (
                              <div className="px-1.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                {sectionLabel}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              data-input-surface-index={index}
                              onPointerMove={(event) => {
                                if (event.pointerType !== 'touch') {
                                  setActiveIndexForCurrentItems(index);
                                }
                              }}
                              onPointerDown={(event) => {
                                if (event.button > 0) {
                                  return;
                                }
                                event.preventDefault();
                                onSelectItem(item);
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  onSelectItem(item);
                                }
                              }}
                              className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left leading-4 transition-colors ${
                                isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <span className="truncate text-xs font-medium">{title}</span>
                              <span className="truncate text-xs text-gray-500">{subtitle}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div
            className="custom-scrollbar min-h-0 min-w-0 select-text overflow-y-auto overscroll-contain p-2.5"
            onPointerDown={onDetailsPointerDown}
          >
            {activeItem ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {activeItem.subtitle}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{activeItem.title}</span>
                </div>
                <p className="text-xs leading-5 text-gray-600">{activeItem.description}</p>
                <div className="space-y-1">
                  {activeItem.detailLines.map((line) => (
                    <div
                      key={line}
                      className="min-w-0 break-all rounded-md bg-gray-50 px-2 py-1 text-[11px] leading-5 text-gray-600"
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div className="pt-1 text-[11px] text-gray-500">
                  {activeItem.hintLabel ?? texts.itemHintLabel}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">{texts.hintLabel}</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
