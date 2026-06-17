import { useEffect, useRef } from 'react';

const DEFAULT_THRESHOLD_PX = 160;

type UseInfiniteScrollLoaderParams = {
  disabled: boolean;
  onLoadMore: () => Promise<unknown> | unknown;
  thresholdPx?: number;
  watchValue?: string | number;
};

export function useInfiniteScrollLoader({
  disabled,
  onLoadMore,
  thresholdPx = DEFAULT_THRESHOLD_PX,
  watchValue
}: UseInfiniteScrollLoaderParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const loadingRef = useRef(false);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (disabled) {
      loadingRef.current = false;
    }
  }, [disabled]);

  useEffect(() => {
    const container = containerRef.current;
    const sentinel = sentinelRef.current;

    if (disabled || !container || !sentinel) {
      return;
    }

    const triggerLoadMore = () => {
      if (loadingRef.current || disabled) {
        return;
      }

      loadingRef.current = true;
      Promise.resolve(onLoadMoreRef.current()).finally(() => {
        loadingRef.current = false;
      });
    };

    const maybeLoadMore = () => {
      const remainingDistance = sentinel.getBoundingClientRect().top - container.getBoundingClientRect().bottom;
      if (remainingDistance <= thresholdPx) {
        triggerLoadMore();
      }
    };

    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            triggerLoadMore();
          }
        },
        {
          root: container,
          rootMargin: `0px 0px ${thresholdPx}px 0px`
        }
      );

      observer.observe(sentinel);
      maybeLoadMore();

      return () => {
        observer.disconnect();
      };
    }

    container.addEventListener('scroll', maybeLoadMore, { passive: true });
    maybeLoadMore();

    return () => {
      container.removeEventListener('scroll', maybeLoadMore);
    };
  }, [disabled, thresholdPx, watchValue]);

  return {
    containerRef,
    sentinelRef
  };
}
