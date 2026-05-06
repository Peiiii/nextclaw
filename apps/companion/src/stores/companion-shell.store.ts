import { create } from "zustand";

export type CompanionShellSnapshot = {
  baseUrl: string;
  bootstrapped: boolean;
};

type CompanionShellStoreState = {
  snapshot: CompanionShellSnapshot;
  setSnapshot: (snapshot: CompanionShellSnapshot) => void;
  reset: () => void;
};

export const createInitialCompanionShellSnapshot = (): CompanionShellSnapshot => ({
  baseUrl: "http://127.0.0.1:55667",
  bootstrapped: false
});

export const useCompanionShellStore = create<CompanionShellStoreState>((set) => ({
  snapshot: createInitialCompanionShellSnapshot(),
  setSnapshot: (snapshot) => {
    set({ snapshot });
  },
  reset: () => {
    set({ snapshot: createInitialCompanionShellSnapshot() });
  }
}));
