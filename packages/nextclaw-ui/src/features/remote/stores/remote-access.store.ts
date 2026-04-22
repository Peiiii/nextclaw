import type { RemoteDoctorView } from '@/shared/lib/api';
import { create } from 'zustand';

type RemoteAccessStoreState = {
  enabled: boolean;
  deviceName: string;
  platformApiBase: string;
  draftTouched: boolean;
  advancedOpen: boolean;
  actionLabel: string | null;
  doctor: RemoteDoctorView | null;
  setEnabled: (enabled: boolean) => void;
  setDeviceName: (deviceName: string) => void;
  setPlatformApiBase: (platformApiBase: string) => void;
  setAdvancedOpen: (advancedOpen: boolean) => void;
  hydrateDraft: (payload: { enabled: boolean; deviceName: string; platformApiBase: string }) => void;
  beginAction: (actionLabel: string) => void;
  finishAction: () => void;
  setDoctor: (doctor: RemoteDoctorView | null) => void;
};

export const useRemoteAccessStore = create<RemoteAccessStoreState>((set) => ({
  enabled: false,
  deviceName: '',
  platformApiBase: '',
  advancedOpen: false,
  draftTouched: false,
  actionLabel: null,
  doctor: null,
  setEnabled: (enabled) => set({ enabled, draftTouched: true }),
  setDeviceName: (deviceName) => set({ deviceName, draftTouched: true }),
  setPlatformApiBase: (platformApiBase) => set({ platformApiBase, draftTouched: true }),
  setAdvancedOpen: (advancedOpen) => set({ advancedOpen }),
  hydrateDraft: ({ enabled, deviceName, platformApiBase }) =>
    set({
      enabled,
      deviceName,
      platformApiBase,
      draftTouched: false
    }),
  beginAction: (actionLabel) => set({ actionLabel }),
  finishAction: () => set({ actionLabel: null }),
  setDoctor: (doctor) => set({ doctor })
}));
