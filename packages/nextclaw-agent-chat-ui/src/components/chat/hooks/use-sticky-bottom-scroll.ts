import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type UseStickyBottomScrollParams = {
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

  const queueScrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (scheduledScrollFrameRef.current !== null) {
      cancelAnimationFrame(scheduledScrollFrameRef.current);
    }

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
  }, [scrollRef]);

  const scrollToBottom = useCallback(() => {
    updateStickyState(true);
    queueScrollToBottom();
  }, [queueScrollToBottom, updateStickyState]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    updateStickyState(resolveIsAtBottom(element));
  }, [resolveIsAtBottom, scrollRef, updateStickyState]);

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    updateStickyState(true);
    pendingInitialScrollRef.current = true;
  }, [resetKey, updateStickyState]);

  useEffect(() => {
    return () => {
      const scheduledScrollFrame = scheduledScrollFrameRef.current;
      if (scheduledScrollFrame !== null) {
        cancelAnimationFrame(scheduledScrollFrame);
        scheduledScrollFrameRef.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (
      !pendingInitialScrollRef.current ||
      isLoading ||
      !hasContent
    ) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    pendingInitialScrollRef.current = false;
    queueScrollToBottom();
  }, [hasContent, isLoading, queueScrollToBottom, scrollRef]);

  useLayoutEffect(() => {
    if (!isStickyRef.current || !hasContent) {
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    queueScrollToBottom();
  }, [contentVersion, hasContent, queueScrollToBottom, scrollRef]);

  return { isAtBottom, onScroll, scrollToBottom };
}
