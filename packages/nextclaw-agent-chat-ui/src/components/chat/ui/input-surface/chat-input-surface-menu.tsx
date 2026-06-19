import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useActiveItemScroll } from '@agent-chat-ui/components/chat/hooks/use-active-item-scroll';
import { useElementWidth } from '@agent-chat-ui/components/chat/hooks/use-element-width';
import {
  ChatUiPrimitives,
  createChatPopoverAvailableHeightLimit,
} from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type { ChatInputSurfaceMenuProps } from '@agent-chat-ui/lib/input-surface';

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
    items,
    texts,
    onSelectItem,
    onOpenChange,
    onDetailsPointerDown,
  } = props;
  const itemsSignature = useMemo(() => items.map((item) => item.key).join('\u001f'), [items]);
  const activeIndex = activeState.itemsSignature === itemsSignature ? activeState.index : 0;
  const activeIndexInRange = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);
  const activeItem = items[activeIndexInRange] ?? null;
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

      if (items.length === 0) {
        return false;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndexForCurrentItems((index) => (index + 1) % items.length);
        return true;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndexForCurrentItems((index) => (index - 1 + items.length) % items.length);
        return true;
      }

      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        onSelectItem(items[activeIndexInRange]);
        return true;
      }

      return false;
    },
  }), [activeIndexInRange, isOpen, items, onOpenChange, onSelectItem, setActiveIndexForCurrentItems]);

  useActiveItemScroll({
    containerRef: listRef,
    activeIndex: activeIndexInRange,
    itemCount: items.length,
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
          <div
            ref={listRef}
            role="listbox"
            aria-label={texts.sectionLabel}
            className="custom-scrollbar min-h-0 overflow-y-auto overscroll-contain border-r border-gray-200 p-2.5"
          >
            {isLoading ? (
              <div className="p-2 text-xs text-gray-500">{texts.loadingLabel}</div>
            ) : (
              <>
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {texts.sectionLabel}
                </div>
                {items.length === 0 ? (
                  <div className="px-2 text-xs text-gray-400">{texts.emptyLabel}</div>
                ) : (
                  <div className="space-y-1">
                    {items.map((item, index) => {
                      const {
                        key,
                        title,
                        subtitle,
                      } = item;
                      const isActive = index === activeIndexInRange;
                      return (
                        <button
                          key={key}
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
                          className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                            isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate text-xs font-semibold">{title}</span>
                          <span className="truncate text-xs text-gray-500">{subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <div
            className="custom-scrollbar min-h-0 min-w-0 overflow-y-auto overscroll-contain p-2.5"
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
                <div className="pt-1 text-[11px] text-gray-500">{texts.itemHintLabel}</div>
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
