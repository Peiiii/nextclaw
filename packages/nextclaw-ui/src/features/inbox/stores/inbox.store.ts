import { create } from "zustand";

export type InboxSnapshot = {
  readerOpen: boolean;
  activeDeliveryId: string | null;
};

type InboxStore = {
  snapshot: InboxSnapshot;
  setSnapshot: (patch: Partial<InboxSnapshot>) => void;
};

const initialSnapshot: InboxSnapshot = {
  readerOpen: false,
  activeDeliveryId: null,
};

export const useInboxStore = create<InboxStore>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) => set((state) => ({
    snapshot: { ...state.snapshot, ...patch },
  })),
}));
