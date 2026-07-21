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
};

type UseStickyBottomScrollResult = {
  isAtBottom: boolean;
  onScroll: () => void;
  scrollToBottom: () => void;
};

const DEFAULT_STICKY_THRESHOLD_PX = 10;

export function useStickyBottomScroll({
  contentRef,
  contentVersion,
  hasContent,
  isLoading,
  resetKey,
  scrollRef,
  stickyThresholdPx,
}: UseStickyBottomScrollParams): UseStickyBottomScrollResult {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isStickyRef = useRef(true);
  const previousResetKeyRef = useRef<string | null>(null);
  const pendingInitialScrollRef = useRef(false);
  const scheduledScrollFrameRef = useRef<number | null>(null);

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
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    cancelQueuedScroll();

    scheduledScrollFrameRef.current = requestAnimationFrame(() => {
      scheduledScrollFrameRef.current = null;
      const currentElement = scrollRef.current;
      if (!currentElement) {
        return;
      }

      if (typeof currentElement.scrollTo === "function") {
        currentElement.scrollTo({
          top: currentElement.scrollHeight,
          behavior,
        });
      } else {
        currentElement.scrollTop = currentElement.scrollHeight;
      }
    });
  }, [cancelQueuedScroll, scrollRef]);

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

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    updateStickyState(true);
    pendingInitialScrollRef.current = true;
  }, [resetKey, updateStickyState]);

  useEffect(() => {
    return cancelQueuedScroll;
  }, [cancelQueuedScroll]);

  useEffect(() => {
    const content = contentRef?.current;
    if (!content || !hasContent || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (isStickyRef.current) {
        queueScrollToBottom();
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef, hasContent, queueScrollToBottom, resetKey]);

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
