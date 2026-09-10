import { useCallback, useLayoutEffect, useRef, type RefObject, type UIEvent } from 'react';
import { scrollRestorationManager, type ScrollRestorationPosition } from '@/shared/lib/navigation-history';

type UseScrollRestorationParams<T extends HTMLElement> = {
  restorationKey: string | null;
  scrollRef?: RefObject<T>;
  isEnabled?: boolean;
};

/** DOM bridge: retry after delayed layout, yield to user input, never save a loading-time zero. */
export function useScrollRestoration<T extends HTMLElement>({ restorationKey, scrollRef, isEnabled = true }: UseScrollRestorationParams<T>) {
  const internalScrollRef = useRef<T>(null);
  const lastKnownPositionRef = useRef<ScrollRestorationPosition | null>(null);
  const pendingRef = useRef(false);
  const resolvedScrollRef = scrollRef ?? internalScrollRef;

  useLayoutEffect(() => {
    if (!isEnabled || !restorationKey) return;
    const element = resolvedScrollRef.current;
    if (!element) return;
    const position = scrollRestorationManager.read(restorationKey);
    lastKnownPositionRef.current = position;
    pendingRef.current = Boolean(position);
    const restore = () => {
      if (!pendingRef.current || !position) return;
      element.scrollLeft = position.x;
      element.scrollTop = position.y;
      if (Math.abs(element.scrollTop - position.y) < 1 && Math.abs(element.scrollLeft - position.x) < 1) pendingRef.current = false;
    };
    const takeOver = () => { pendingRef.current = false; };
    restore();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(restore);
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      for (const child of element.children) observer?.observe(child);
      restore();
    });
    mutations?.observe(element, { childList: true, subtree: true });
    element.addEventListener('wheel', takeOver, { passive: true });
    element.addEventListener('touchstart', takeOver, { passive: true });
    element.addEventListener('pointerdown', takeOver);
    element.addEventListener('keydown', takeOver);
    return () => {
      observer?.disconnect(); mutations?.disconnect();
      element.removeEventListener('wheel', takeOver); element.removeEventListener('touchstart', takeOver);
      element.removeEventListener('pointerdown', takeOver); element.removeEventListener('keydown', takeOver);
      if (lastKnownPositionRef.current) scrollRestorationManager.save(restorationKey, lastKnownPositionRef.current);
      pendingRef.current = false;
    };
  }, [isEnabled, restorationKey, resolvedScrollRef]);

  const onScroll = useCallback((event: UIEvent<T>) => {
    if (!isEnabled || !restorationKey || pendingRef.current || event.currentTarget.closest('[hidden]') !== null) return;
    const position = { x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop };
    lastKnownPositionRef.current = position;
    scrollRestorationManager.save(restorationKey, position);
  }, [isEnabled, restorationKey]);

  return { onScroll, scrollRef: resolvedScrollRef };
}
