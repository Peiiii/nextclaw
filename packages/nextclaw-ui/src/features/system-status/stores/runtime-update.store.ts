import type { UpdateSnapshot } from '@nextclaw/shared';
import { create } from 'zustand';

export type RuntimeUpdateBusyAction =
  | 'checking'
  | 'downloading'
  | 'applying'
  | 'saving-preferences'
  | 'switching-channel'
  | null;

type RuntimeUpdateStoreState = {
  supported: boolean;
  initialized: boolean;
  busyAction: RuntimeUpdateBusyAction;
  snapshot: UpdateSnapshot | null;
};

export const useRuntimeUpdateStore = create<RuntimeUpdateStoreState>(() => ({
  supported: false,
  initialized: false,
  busyAction: null,
  snapshot: null
}));
