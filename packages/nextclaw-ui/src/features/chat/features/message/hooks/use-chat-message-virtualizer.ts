import { useCallback, useMemo, useRef, type RefObject } from "react";
import {
  defaultRangeExtractor,
  elementScroll,
  useVirtualizer,
} from "@tanstack/react-virtual";

const ESTIMATED_CHAT_MESSAGE_ROW_HEIGHT = 180;

export function useChatMessageVirtualizer(params: {
  rows: readonly { key: string }[];
  scrollRef: RefObject<HTMLDivElement | null>;
  activeRowKey?: string | null;
  focusedRowKey?: string | null;
}) {
  const { activeRowKey, focusedRowKey, rows, scrollRef } = params;
  const pinnedIndexes = useMemo(
    () =>
      rows.flatMap((row, index) =>
        row.key === activeRowKey || row.key === focusedRowKey ? [index] : [],
      ),
    [activeRowKey, focusedRowKey, rows],
  );
  const rangeExtractor = useCallback(
    (range: Parameters<typeof defaultRangeExtractor>[0]) =>
      [...new Set([...defaultRangeExtractor(range), ...pinnedIndexes])].sort(
        (left, right) => left - right,
      ),
    [pinnedIndexes],
  );
  const sizeContainerRef = useRef<HTMLDivElement | null>(null);

  // TanStack Virtual intentionally exposes imperative measurement methods;
  // this hook does not pass the returned virtualizer through memoized owners.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    anchorTo: "end",
    count: rows.length,
    directDomUpdates: true,
    estimateSize: () => ESTIMATED_CHAT_MESSAGE_ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.key ?? index,
    getScrollElement: () => scrollRef.current,
    initialOffset: () => rows.length * ESTIMATED_CHAT_MESSAGE_ROW_HEIGHT,
    initialRect: { width: 0, height: 800 },
    overscan: 8,
    rangeExtractor,
    scrollToFn: (offset, options, instance) => {
      const sizeContainer = sizeContainerRef.current;
      if (sizeContainer) {
        sizeContainer.style.height = `${instance.getTotalSize()}px`;
      }
      elementScroll(offset, options, instance);
    },
  });
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item) =>
    item.start < (virtualizer.scrollOffset ?? 0);
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      sizeContainerRef.current = node;
      virtualizer.containerRef(node);
    },
    [virtualizer],
  );

  return { containerRef, virtualizer };
}
