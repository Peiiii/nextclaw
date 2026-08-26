import { useCallback, useLayoutEffect, useRef, type RefObject, type UIEvent } from "react";
import {
  scrollRestorationManager,
  type ScrollRestorationPosition,
} from "@/shared/lib/navigation-history";

type UseScrollRestorationParams<T extends HTMLElement> = {
  restorationKey: string | null;
  scrollRef?: RefObject<T>;
  isEnabled?: boolean;
};

/** Connects one DOM scroll surface to the shared in-memory navigation history. */
export function useScrollRestoration<T extends HTMLElement>({
  restorationKey,
  scrollRef,
  isEnabled = true,
}: UseScrollRestorationParams<T>) {
  const internalScrollRef = useRef<T>(null);
  const lastKnownPositionRef = useRef<ScrollRestorationPosition | null>(null);
  const resolvedScrollRef = scrollRef ?? internalScrollRef;

  useLayoutEffect(() => {
    if (!isEnabled || !restorationKey) return;
    const element = resolvedScrollRef.current;
    const position = scrollRestorationManager.read(restorationKey);
    if (element && position) {
      element.scrollLeft = position.x;
      element.scrollTop = position.y;
    }
    if (element) {
      lastKnownPositionRef.current = {
        x: element.scrollLeft,
        y: element.scrollTop,
      };
    }

    return () => {
      if (!element) return;
      scrollRestorationManager.save(
        restorationKey,
        lastKnownPositionRef.current ?? {
          x: element.scrollLeft,
          y: element.scrollTop,
        },
      );
    };
  }, [isEnabled, restorationKey, resolvedScrollRef]);

  const onScroll = useCallback((event: UIEvent<T>) => {
    if (!isEnabled || !restorationKey) return;
    const position = {
      x: event.currentTarget.scrollLeft,
      y: event.currentTarget.scrollTop,
    };
    lastKnownPositionRef.current = position;
    scrollRestorationManager.save(restorationKey, position);
  }, [isEnabled, restorationKey]);

  return { onScroll, scrollRef: resolvedScrollRef };
}
