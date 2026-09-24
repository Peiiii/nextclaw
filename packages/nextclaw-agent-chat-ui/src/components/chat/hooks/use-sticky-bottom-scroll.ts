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
const USER_SCROLL_INTENT_MS = 1500;
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

function isScrollAtBottom(element: HTMLElement, threshold = DEFAULT_STICKY_THRESHOLD_PX) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function getContentDistanceFromBottom(scroll: HTMLElement, content: HTMLElement | undefined) {
  return content
    ? content.getBoundingClientRect().bottom - scroll.getBoundingClientRect().top - scroll.clientTop - scroll.clientHeight
    : scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
}

function isExpansionActivation(event: Event): boolean {
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return false;
  const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
  const control = target?.closest('button, a, input, textarea, select, [role="button"], summary');
  return Boolean(control?.matches(
    '[aria-expanded="false"]:not([aria-haspopup]):not(:disabled), details:not([open]) > summary',
  ));
}

function observeExpansions(element: HTMLElement | null, onExpand: () => void) {
  const activate = (event: Event) => { if (isExpansionActivation(event)) onExpand(); };
  element?.addEventListener("click", activate, true);
  element?.addEventListener("keydown", activate, true);
  return () => {
    element?.removeEventListener("click", activate, true);
    element?.removeEventListener("keydown", activate, true);
  };
}

function observeUserScrollIntent(element: HTMLElement | null, onIntent: () => void) {
  if (!element) return () => undefined;
  const onKeyDown = (event: KeyboardEvent) => {
    const { target } = event;
    if (!SCROLL_KEYS.has(event.key) ||
      (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    onIntent();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.target === element) onIntent();
  };
  element.addEventListener("wheel", onIntent);
  element.addEventListener("touchmove", onIntent);
  element.addEventListener("keydown", onKeyDown);
  element.addEventListener("pointerdown", onPointerDown);
  return () => {
    element.removeEventListener("wheel", onIntent);
    element.removeEventListener("touchmove", onIntent);
    element.removeEventListener("keydown", onKeyDown);
    element.removeEventListener("pointerdown", onPointerDown);
  };
}

function observeContentResize(content: HTMLElement | null, scroll: HTMLElement | null, onResize: () => void) {
  if (!content || typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver(onResize);
  observer.observe(content);
  if (scroll) observer.observe(scroll);
  return () => observer.disconnect();
}

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
  const userScrollIntentUntilRef = useRef(0);
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

  // Content visibility is independent of following intent and the reserved turn space.
  const updateBottomVisibility = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const distance = getContentDistanceFromBottom(scroll, contentRef?.current ?? undefined);
    setIsAtBottom(distance <= (stickyThresholdPx ?? DEFAULT_STICKY_THRESHOLD_PX));
  }, [contentRef, scrollRef, stickyThresholdPx]);

  const updateStickyState = useCallback((nextIsAtBottom: boolean) => {
    isStickyRef.current = nextIsAtBottom;
    updateBottomVisibility();
  }, [updateBottomVisibility]);

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
        currentElement.scrollTo({ top: currentElement.scrollHeight, behavior });
      } else {
        currentElement.scrollTop = currentElement.scrollHeight;
      }
      updateBottomVisibility();
    });
  }, [cancelQueuedScroll, scrollRef, updateTurnSpace, updateBottomVisibility]);

  const scrollToBottom = useCallback(() => {
    userScrollIntentUntilRef.current = 0;
    updateStickyState(true);
    queueScrollToBottom();
  }, [queueScrollToBottom, updateStickyState]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (Date.now() <= userScrollIntentUntilRef.current) {
      const nextIsAtBottom = isScrollAtBottom(element, stickyThresholdPx);
      if (!nextIsAtBottom) cancelQueuedScroll();
      isStickyRef.current = nextIsAtBottom;
    }
    updateBottomVisibility();
  }, [cancelQueuedScroll, stickyThresholdPx, scrollRef, updateBottomVisibility]);

  useEffect(() => observeUserScrollIntent(scrollRef.current, () => {
    userScrollIntentUntilRef.current = Date.now() + USER_SCROLL_INTENT_MS;
  }), [resetKey, scrollRef]);

  // Inspection wins over queued output, animation and lazy payload growth until scrolling resumes.
  useEffect(() => observeExpansions(scrollRef.current, () => {
    pendingInitialScrollRef.current = false;
    userScrollIntentUntilRef.current = 0;
    cancelQueuedScroll();
    updateStickyState(false);
  }), [cancelQueuedScroll, hasContent, resetKey, scrollRef, updateStickyState]);

  useLayoutEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    const isFirstTurn = previousResetKeyRef.current === null && previousTurnKeyRef.current === null;
    previousResetKeyRef.current = resetKey;
    if (!isFirstTurn) previousTurnKeyRef.current = turnSpaceRef.current?.key;
    activeTurnKeyRef.current = null;
    userScrollIntentUntilRef.current = 0;
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
    userScrollIntentUntilRef.current = 0;
    updateStickyState(false);
    queueScrollToBottom();
  }, [isLoading, queueScrollToBottom, turnSpace?.key, updateStickyState, updateTurnSpace]);

  useEffect(() => cancelQueuedScroll, [cancelQueuedScroll]);

  useEffect(() => {
    if (!hasContent) return;
    return observeContentResize(contentRef?.current ?? null, scrollRef.current, () => {
      updateTurnSpace();
      updateBottomVisibility();
      if (isStickyRef.current) {
        queueScrollToBottom();
      }
    });
  }, [contentRef, hasContent, queueScrollToBottom, resetKey, scrollRef, updateTurnSpace, updateBottomVisibility]);

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
