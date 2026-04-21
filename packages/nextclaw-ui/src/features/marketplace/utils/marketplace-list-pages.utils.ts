import type { InfiniteData } from '@tanstack/react-query';
import type { MarketplaceListView } from '@/api/types';

export type InfiniteMarketplaceListView = MarketplaceListView & {
  pages: MarketplaceListView[];
  loadedItems: number;
  loadedPages: number;
};

export function collapseMarketplaceListPages(
  data: InfiniteData<MarketplaceListView> | undefined
): InfiniteMarketplaceListView | undefined {
  if (!data || data.pages.length === 0) {
    return undefined;
  }

  const items = data.pages.flatMap((page) => page.items);
  const lastPage = data.pages[data.pages.length - 1];

  return {
    ...lastPage,
    items,
    pages: data.pages,
    loadedItems: items.length,
    loadedPages: data.pages.length
  };
}
