import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, Command, File, Files, Folder, PanelsTopLeft, Puzzle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useActiveItemScroll } from '@agent-chat-ui/components/chat/hooks/use-active-item-scroll';
import { useElementWidth } from '@agent-chat-ui/components/chat/hooks/use-element-width';
import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type {
  ChatInputSurfaceFilterOption,
  ChatInputSurfaceItem,
  ChatInputSurfaceItemIcon,
  ChatInputSurfaceMenuTexts,
  ChatInputSurfaceMenuProps,
} from '@agent-chat-ui/lib/input-surface';
import { ChatInputSurfacePathPreview } from './chat-input-surface-path-preview';

const INPUT_SURFACE_PANEL_MAX_WIDTH = 680;
const INPUT_SURFACE_PANEL_DESKTOP_SHRINK_RATIO = 0.82;
const INPUT_SURFACE_PANEL_DESKTOP_MIN_WIDTH = 560;
const INPUT_SURFACE_PANEL_MAX_HEIGHT = createChatPopoverAvailableHeightLimit('24rem');

export type ChatInputSurfaceMenuHandle = {
  handleKeyDown: (event: KeyboardEvent) => boolean;
};

type ChatInputSurfaceFilterView = ChatInputSurfaceFilterOption & {
  count: number;
};

const INPUT_SURFACE_ITEM_ICONS: Record<ChatInputSurfaceItemIcon, LucideIcon> = {
  back: ArrowLeft,
  command: Command,
  file: File,
  files: Files,
  folder: Folder,
  'panel-app': PanelsTopLeft,
  skill: Puzzle,
};

function itemMatchesFilter(item: ChatInputSurfaceItem, filter: ChatInputSurfaceFilterOption): boolean {
  if (!filter.sectionKeys || filter.sectionKeys.length === 0) {
    return true;
  }
  return Boolean(item.sectionKey && filter.sectionKeys.includes(item.sectionKey));
}

function resolveActiveFilterKey(
  filters: readonly ChatInputSurfaceFilterOption[] | undefined,
  activeFilterKey: string | null,
): string | null {
  if (!filters?.length) {
    return null;
  }
  return filters.some((filter) => filter.key === activeFilterKey)
    ? activeFilterKey
    : filters[0].key;
}

function InputSurfaceItemIcon({ icon }: { icon: ChatInputSurfaceItemIcon }) {
  const Icon = INPUT_SURFACE_ITEM_ICONS[icon];
  return (
    <span
      aria-hidden="true"
      data-input-surface-icon={icon}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function InputSurfaceItemDetails({
  item,
  texts,
}: {
  item: ChatInputSurfaceItem | null;
  texts: ChatInputSurfaceMenuTexts;
}) {
  if (!item) {
    return <div className="text-xs text-gray-500">{texts.hintLabel}</div>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {item.subtitle ? (
          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {item.subtitle}
          </span>
        ) : null}
        <span className="text-sm font-semibold text-gray-900">{item.title}</span>
      </div>
      <p className="text-xs leading-5 text-gray-600">{item.description}</p>
      {item.pathPreview ? (
        <ChatInputSurfacePathPreview pathPreview={item.pathPreview} />
      ) : null}
      <div className="space-y-1">
        {item.detailLines.map((line) => (
          <div
            key={line}
            className="min-w-0 break-all rounded-md bg-gray-50 px-2 py-1 text-[11px] leading-5 text-gray-600"
          >
            {line}
          </div>
        ))}
      </div>
      <div className="pt-1 text-[11px] text-gray-500">
        {item.hintLabel ?? texts.itemHintLabel}
      </div>
    </div>
  );
}

function handleInputSurfaceMenuKeyDown(params: {
  activeIndex: number;
  event: KeyboardEvent;
  isOpen: boolean;
  items: ChatInputSurfaceItem[];
  onOpenChange: (open: boolean) => void;
  onSelectItem: (item: ChatInputSurfaceItem) => void;
  setActiveIndex: (nextIndex: number | ((currentIndex: number) => number)) => void;
}): boolean {
  const {
    activeIndex,
    event,
    isOpen,
    items,
    onOpenChange,
    onSelectItem,
    setActiveIndex,
  } = params;
  if (!isOpen) {
    return false;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    onOpenChange(false);
    return true;
  }
  if (items.length === 0) {
    return false;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setActiveIndex((index) => (index + 1) % items.length);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setActiveIndex((index) => (index - 1 + items.length) % items.length);
    return true;
  }
  if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
    event.preventDefault();
    onSelectItem(items[activeIndex]);
    return true;
  }
  return false;
}

export const ChatInputSurfaceMenu = forwardRef<ChatInputSurfaceMenuHandle, ChatInputSurfaceMenuProps>(
function ChatInputSurfaceMenu(props, ref) {
  const { Popover, PopoverAnchor, PopoverContent } = ChatUiPrimitives;
  const { elementRef: anchorRef, width: panelWidth } = useElementWidth<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeState, setActiveState] = useState({
    index: 0,
    itemsSignature: '',
  });
  const {
    isOpen,
    isLoading,
    filterOptions,
    items,
    notice,
    texts,
    onSelectItem,
    onOpenChange,
    onDetailsPointerDown,
  } = props;
  const firstFilterKey = filterOptions?.[0]?.key ?? null;
  const [activeFilterKey, setActiveFilterKey] = useState<string | null>(firstFilterKey);
  const resolvedActiveFilterKey = useMemo(
    () => resolveActiveFilterKey(filterOptions, activeFilterKey),
    [activeFilterKey, filterOptions],
  );
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
  const itemsSignature = useMemo(() => visibleItems.map((item) => item.key).join('\u001f'), [visibleItems]);
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
  const selectItem = useCallback((item: ChatInputSurfaceItem): void => {
    if (item.selectionBehavior === 'navigate') {
      setActiveState({ index: 0, itemsSignature: '' });
    }
    onSelectItem(item);
  }, [onSelectItem]);

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
    handleKeyDown: (event) => handleInputSurfaceMenuKeyDown({
      activeIndex: activeIndexInRange,
      event,
      isOpen,
      items: visibleItems,
      onOpenChange,
      onSelectItem: selectItem,
      setActiveIndex: setActiveIndexForCurrentItems,
    }),
  }), [activeIndexInRange, isOpen, onOpenChange, selectItem, setActiveIndexForCurrentItems, visibleItems]);

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
          height: INPUT_SURFACE_PANEL_MAX_HEIGHT,
          maxHeight: INPUT_SURFACE_PANEL_MAX_HEIGHT,
          width: resolvedWidth ? `${resolvedWidth}px` : undefined,
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
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
            {!isLoading && notice ? (
              <div className="mx-2 mb-1.5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs leading-4 text-red-700">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{notice.message}</span>
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
                        const { icon, key, sectionKey, sectionLabel, title, subtitle } = item;
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
                                selectItem(item);
                              }}
                              onClick={(event) => {
                                if (event.detail === 0) {
                                  selectItem(item);
                                }
                              }}
                              className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left leading-4 transition-colors ${
                                isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {icon ? <InputSurfaceItemIcon icon={icon} /> : null}
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
            <InputSurfaceItemDetails item={activeItem} texts={texts} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
