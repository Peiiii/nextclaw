import { useMemo, useRef } from 'react';
import { useActiveItemScroll } from '../../hooks/use-active-item-scroll';
import { useElementWidth } from '../../hooks/use-element-width';
import { ChatUiPrimitives } from '../primitives/chat-ui-primitives';
import type { ChatSlashMenuProps } from '../../view-models/chat-ui.types';

const SLASH_PANEL_MAX_WIDTH = 680;
const SLASH_PANEL_DESKTOP_SHRINK_RATIO = 0.82;
const SLASH_PANEL_DESKTOP_MIN_WIDTH = 560;

export function ChatSlashMenu(props: ChatSlashMenuProps) {
  const { Popover, PopoverAnchor, PopoverContent } = ChatUiPrimitives;
  const { elementRef: anchorRef, width: panelWidth } = useElementWidth<HTMLDivElement>();
  const listRef = useRef<HTMLDivElement | null>(null);
  const {
    isOpen,
    isLoading,
    items,
    activeIndex,
    activeItem,
    texts,
    onSelectItem,
    onOpenChange,
    onSetActiveIndex
  } = props;

  const resolvedWidth = useMemo(() => {
    if (!panelWidth) {
      return undefined;
    }
    return Math.min(
      panelWidth > SLASH_PANEL_DESKTOP_MIN_WIDTH ? panelWidth * SLASH_PANEL_DESKTOP_SHRINK_RATIO : panelWidth,
      SLASH_PANEL_MAX_WIDTH
    );
  }, [panelWidth]);

  useActiveItemScroll({
    containerRef: listRef,
    activeIndex,
    itemCount: items.length,
    isEnabled: isOpen && !isLoading,
    getItemSelector: (index) => `[data-slash-index="${index}"]`
  });

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="pointer-events-none absolute bottom-full left-3 right-3 h-0" />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="z-[70] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 p-0 shadow-2xl backdrop-blur-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
        style={resolvedWidth ? { width: `${resolvedWidth}px` } : undefined}
      >
        <div className="grid min-h-[240px] grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
          <div
            ref={listRef}
            role="listbox"
            aria-label={texts.slashSectionLabel}
            className="custom-scrollbar max-h-[320px] overflow-y-auto border-r border-gray-200 p-2.5"
          >
            {isLoading ? (
              <div className="p-2 text-xs text-gray-500">{texts.slashLoadingLabel}</div>
            ) : (
              <>
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {texts.slashSectionLabel}
                </div>
                {items.length === 0 ? (
                  <div className="px-2 text-xs text-gray-400">{texts.slashEmptyLabel}</div>
                ) : (
                  <div className="space-y-1">
                    {items.map((item, index) => {
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          data-slash-index={index}
                          onMouseEnter={() => onSetActiveIndex(index)}
                          onClick={() => onSelectItem(item)}
                          className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                            isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span className="truncate text-xs font-semibold">{item.title}</span>
                          <span className="truncate text-xs text-gray-500">{item.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="min-w-0 p-2.5">
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
                <div className="pt-1 text-[11px] text-gray-500">{texts.slashSkillHintLabel}</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">{texts.slashHintLabel}</div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
