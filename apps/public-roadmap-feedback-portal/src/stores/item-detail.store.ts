import { create } from "zustand";

export type ItemDetailSnapshot = {
  activeItemId: string | null;
};

type ItemDetailState = {
  snapshot: ItemDetailSnapshot;
  setSnapshot: (patch: Partial<ItemDetailSnapshot>) => void;
};

const initialSnapshot: ItemDetailSnapshot = {
  activeItemId: null
};

export const useItemDetailStore = create<ItemDetailState>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) => set((state) => ({
    snapshot: {
      ...state.snapshot,
      ...patch
    }
  }))
}));
