import { create } from 'zustand';
import type { SystemStatusState } from '@/features/system-status/types/system-status.types';

type SystemStatusStore = {
  state: SystemStatusState;
  patchState: (patch: Partial<SystemStatusState>) => void;
};

export const initialSystemStatusState: SystemStatusState = {
  lifecyclePhase: 'cold-starting',
  hasReachedReady: false,
  lastReadyAt: null,
  recoveryStartedAt: null,
  bootstrapStatus: null,
  lastError: null,
  lastTransportError: null,
  runtimeControlView: null,
  runtimeControlError: null,
  activeSystemAction: null,
  lastSystemActionError: null,
};

export const useSystemStatusStore = create<SystemStatusStore>((set) => ({
  state: initialSystemStatusState,
  patchState: (patch) =>
    set((current) => ({
      state: {
        ...current.state,
        ...patch,
      },
    })),
}));
