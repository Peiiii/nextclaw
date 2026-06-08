import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
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
  onScroll: () => void;
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
  const isStickyRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const previousResetKeyRef = useRef<string | null>(null);
  const pendingInitialScrollRef = useRef(false);
  const scheduledScrollFrameRef = useRef<number | null>(null);

  const queueScrollToBottom = useCallback(() => {
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

      isProgrammaticScrollRef.current = true;
      currentElement.scrollTop = currentElement.scrollHeight;
    });
  }, [scrollRef]);

  const onScroll = () => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    isStickyRef.current =
      distanceFromBottom <=
      (stickyThresholdPx ?? DEFAULT_STICKY_THRESHOLD_PX);
  };

  useEffect(() => {
    if (previousResetKeyRef.current === resetKey) {
      return;
    }

    previousResetKeyRef.current = resetKey;
    isStickyRef.current = true;
    pendingInitialScrollRef.current = true;
  }, [resetKey]);

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

  return { onScroll };
}
