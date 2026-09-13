import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type UseStickyBottomScrollParams = {
  contentRef?: RefObject<HTMLElement>;
  scrollRef: RefObject<HTMLElement>;
  resetKey: string | null;
  isLoading: boolean;
  hasContent: boolean;
  contentVersion: unknown;
  stickyThresholdPx?: number;
  /** A host-owned restored reading position takes precedence over initial bottom following. */
  initialScrollTop?: number;
  /** Optional space for a newly appended user turn, outside the measured content. */
  turnSpace?: {
    key: string | null;
    anchorRef: RefObject<HTMLElement>;
    frameRef: RefObject<HTMLElement>;
  };
};

type UseStickyBottomScrollResult = {
  isAtBottom: boolean;
  onScroll: () => void;
  scrollToBottom: () => void;
};

const DEFAULT_STICKY_THRESHOLD_PX = 10;

function measureTurnSpace(
  scroll: HTMLElement,
  frame: HTMLElement,
  anchor: HTMLElement | null,
  previousOffset: number | null,
) {
  const viewportTop = scroll.getBoundingClientRect().top;
  const offset = anchor
    ? anchor.getBoundingClientRect().top - viewportTop + scroll.scrollTop
    : previousOffset;
  const frameTop = frame.getBoundingClientRect().top - viewportTop + scroll.scrollTop;
  return {
    offset,
    height: offset === null ? 0 : Math.max(0, offset - frameTop + scroll.clientHeight - 24),
  };
}

export function useStickyBottomScroll({
  contentRef,
  contentVersion,
  hasContent,
  isLoading,
  resetKey,
  scrollRef,
  stickyThresholdPx,
  initialScrollTop,
  turnSpace,
}: UseStickyBottomScrollParams): UseStickyBottomScrollResult {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isStickyRef = useRef(initialScrollTop === undefined);
  const previousResetKeyRef = useRef<string | null>(null);
  const pendingInitialScrollRef = useRef(false);
  const scheduledScrollFrameRef = useRef<number | null>(null);
  const previousTurnKeyRef = useRef(turnSpace?.key);
  const turnOffsetRef = useRef<number | null>(null);
  const activeTurnKeyRef = useRef<string | null>(null);
  const turnSpaceRef = useRef(turnSpace);
  useLayoutEffect(() => { turnSpaceRef.current = turnSpace; });

  const updateTurnSpace = useCallback(() => {
    const space = turnSpaceRef.current;
    const scroll = scrollRef.current;
    if (!space?.frameRef.current || !scroll) return;
    const measurement = measureTurnSpace(scroll, space.frameRef.current,
      activeTurnKeyRef.current === space.key ? space.anchorRef.current : null,
      turnOffsetRef.current);
    turnOffsetRef.current = measurement.offset;
    space.frameRef.current.style.minHeight = `${measurement.height}px`;
  }, [scrollRef]);

  const updateStickyState = useCallback((nextIsAtBottom: boolean) => {
    isStickyRef.current = nextIsAtBottom;
    setIsAtBottom(nextIsAtBottom);
  }, []);

  const resolveIsAtBottom = useCallback(
    (element: HTMLElement): boolean => {
      const distanceFromBottom =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      return (
        distanceFromBottom <=
        (stickyThresholdPx ?? DEFAULT_STICKY_THRESHOLD_PX)
      );
    },
    [stickyThresholdPx],
  );

  const cancelQueuedScroll = useCallback(() => {
    const scheduledScrollFrame = scheduledScrollFrameRef.current;
    if (scheduledScrollFrame === null) {
      return;
    }
    cancelAnimationFrame(scheduledScrollFrame);
    scheduledScrollFrameRef.current = null;
  }, []);

  const queueScrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    cancelQueuedScroll();

    scheduledScrollFrameRef.current = requestAnimationFrame(() => {
      scheduledScrollFrameRef.current = null;
      const currentElement = scrollRef.current;
      if (!currentElement) {
        return;
      }

      updateTurnSpace();

      if (typeof currentElement.scrollTo === "function") {
        currentElement.scrollTo({
          top: currentElement.scrollHeight,
          behavior,
        });
      } else {
        currentElement.scrollTop = currentElement.scrollHeight;
      }
    });
  }, [cancelQueuedScroll, scrollRef, updateTurnSpace]);

  const scrollToBottom = useCallback(() => {
    updateStickyState(true);
    queueScrollToBottom();
  }, [queueScrollToBottom, updateStickyState]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const nextIsAtBottom = resolveIsAtBottom(element);
    if (!nextIsAtBottom) {
      cancelQueuedScroll();
    }
    updateStickyState(nextIsAtBottom);
  }, [cancelQueuedScroll, resolveIsAtBottom, scrollRef, updateStickyState]);

  useLayoutEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    const isFirstTurn = previousResetKeyRef.current === null && previousTurnKeyRef.current === null;
    previousResetKeyRef.current = resetKey;
    if (!isFirstTurn) previousTurnKeyRef.current = turnSpaceRef.current?.key;
    activeTurnKeyRef.current = null;
    turnOffsetRef.current = null;
    updateTurnSpace();
    updateStickyState(initialScrollTop === undefined);
    pendingInitialScrollRef.current = initialScrollTop === undefined;
  }, [resetKey, initialScrollTop, updateStickyState, updateTurnSpace]);

  useLayoutEffect(() => {
    const key = turnSpace?.key;
    if (key === previousTurnKeyRef.current) return;
    previousTurnKeyRef.current = key;
    if (!key || isLoading || !isStickyRef.current) return;
    activeTurnKeyRef.current = key;
    updateTurnSpace();
    queueScrollToBottom();
  }, [isLoading, queueScrollToBottom, turnSpace?.key, updateTurnSpace]);

  useEffect(() => {
    return cancelQueuedScroll;
  }, [cancelQueuedScroll]);

  useEffect(() => {
    const content = contentRef?.current;
    if (!content || !hasContent || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      updateTurnSpace();
      if (isStickyRef.current) {
        queueScrollToBottom();
      }
    });
    observer.observe(content);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [contentRef, hasContent, queueScrollToBottom, resetKey, scrollRef, updateTurnSpace]);

  useLayoutEffect(() => {
    if (
      !pendingInitialScrollRef.current ||
      isLoading ||
      !hasContent
    ) {
      return;
    }

    pendingInitialScrollRef.current = false;
    queueScrollToBottom();
  }, [hasContent, isLoading, queueScrollToBottom]);

  useLayoutEffect(() => {
    if (!isStickyRef.current || !hasContent) {
      return;
    }

    queueScrollToBottom();
  }, [contentVersion, hasContent, queueScrollToBottom]);

  return { isAtBottom, onScroll, scrollToBottom };
}
