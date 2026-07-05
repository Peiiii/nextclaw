import { create } from 'zustand';

export type MarketplaceDetailDocStatus = 'loading' | 'ready' | 'error';

export type MarketplaceDetailDocEntry = {
  id: string;
  title: string;
  typeLabel: string;
  spec: string;
  status: MarketplaceDetailDocStatus;
  summary?: string;
  description?: string;
  metadataRaw?: string;
  contentRaw?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  author?: string;
};

type MarketplaceDetailDocStore = {
  entries: Record<string, MarketplaceDetailDocEntry>;
  setEntry: (entry: MarketplaceDetailDocEntry) => void;
};

export const useMarketplaceDetailDocStore = create<MarketplaceDetailDocStore>((set) => ({
  entries: {},
  setEntry: (entry) => set((state) => ({
    entries: {
      ...state.entries,
      [entry.id]: entry,
    },
  })),
}));

export function setMarketplaceDetailDocEntry(entry: MarketplaceDetailDocEntry): void {
  useMarketplaceDetailDocStore.getState().setEntry(entry);
}
