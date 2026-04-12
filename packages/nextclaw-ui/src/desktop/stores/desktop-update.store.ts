import type { DesktopUpdateSnapshot } from '@/desktop/desktop-update.types';
import { create } from 'zustand';

type DesktopUpdateBusyAction = 'checking' | 'downloading' | 'applying' | 'saving-preferences' | null;

type DesktopUpdateStoreState = {
  supported: boolean;
  initialized: boolean;
  busyAction: DesktopUpdateBusyAction;
  snapshot: DesktopUpdateSnapshot | null;
};

export const useDesktopUpdateStore = create<DesktopUpdateStoreState>(() => ({
  supported: false,
  initialized: false,
  busyAction: null,
  snapshot: null
}));
