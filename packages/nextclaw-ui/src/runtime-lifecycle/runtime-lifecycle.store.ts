import { create } from 'zustand';
import type { RuntimeLifecycleSnapshot } from './runtime-lifecycle.types';

type RuntimeLifecycleStore = {
  snapshot: RuntimeLifecycleSnapshot;
  setSnapshot: (patch: Partial<RuntimeLifecycleSnapshot>) => void;
};

export const initialRuntimeLifecycleSnapshot: RuntimeLifecycleSnapshot = {
  phase: 'cold-starting',
  hasReachedReady: false,
  lastReadyAt: null,
  recoveryStartedAt: null,
  bootstrapStatus: null,
  lastError: null,
  lastTransportError: null,
};

export const useRuntimeLifecycleStore = create<RuntimeLifecycleStore>((set) => ({
  snapshot: initialRuntimeLifecycleSnapshot,
  setSnapshot: (patch) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        ...patch,
      },
    })),
}));
