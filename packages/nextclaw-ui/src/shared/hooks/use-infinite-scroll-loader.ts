import { useEffect, useRef } from 'react';

const DEFAULT_THRESHOLD_PX = 160;

type UseInfiniteScrollLoaderParams = {
  disabled: boolean;
  onLoadMore: () => Promise<unknown> | unknown;
  thresholdPx?: number;
  watchValue?: string | number;
};

export function useInfiniteScrollLoader(params: UseInfiniteScrollLoaderParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(params.onLoadMore);
  const loadingRef = useRef(false);

  useEffect(() => {
    onLoadMoreRef.current = params.onLoadMore;
  }, [params.onLoadMore]);

  useEffect(() => {
    if (params.disabled) {
      loadingRef.current = false;
    }
  }, [params.disabled]);

  useEffect(() => {
    const container = containerRef.current;
    const sentinel = sentinelRef.current;
    const thresholdPx = params.thresholdPx ?? DEFAULT_THRESHOLD_PX;

    if (params.disabled || !container || !sentinel) {
      return;
    }

    const triggerLoadMore = () => {
      if (loadingRef.current || params.disabled) {
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
  }, [params.disabled, params.thresholdPx, params.watchValue]);

  return {
    containerRef,
    sentinelRef
  };
}
