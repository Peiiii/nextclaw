import type { DesktopPresenceSnapshot } from '@/platforms/desktop/types/desktop-update.types';
import { create } from 'zustand';

type DesktopPresenceBusyAction = 'loading' | 'saving-preferences' | null;

type DesktopPresenceStoreState = {
  supported: boolean;
  initialized: boolean;
  busyAction: DesktopPresenceBusyAction;
  snapshot: DesktopPresenceSnapshot | null;
};

export const useDesktopPresenceStore = create<DesktopPresenceStoreState>(() => ({
  supported: false,
  initialized: false,
  busyAction: null,
  snapshot: null
}));
