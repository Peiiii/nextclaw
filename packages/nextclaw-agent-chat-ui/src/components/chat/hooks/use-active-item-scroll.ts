import { useEffect, type RefObject } from 'react';

type UseActiveItemScrollParams = {
  containerRef: RefObject<HTMLElement>;
  activeIndex: number;
  itemCount: number;
  isEnabled: boolean;
  getItemSelector?: (index: number) => string;
};

const defaultGetItemSelector = (index: number) => `[data-item-index="${index}"]`;

export function useActiveItemScroll(params: UseActiveItemScrollParams) {
  const { activeIndex, containerRef, getItemSelector: customGetItemSelector, isEnabled, itemCount } =
    params;
  const getItemSelector = customGetItemSelector ?? defaultGetItemSelector;

  useEffect(() => {
    if (!isEnabled || itemCount === 0) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const activeItem = container.querySelector<HTMLElement>(getItemSelector(activeIndex));
    if (typeof activeItem?.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeIndex, containerRef, getItemSelector, isEnabled, itemCount]);
}
