import { create } from 'zustand';
import { isPwaInstallBannerDismissed } from '@/features/pwa/utils/pwa-install-banner.utils';
import type { PwaInstallStateSnapshot } from '@/features/pwa/types/pwa.types';

export function createInitialPwaState(): PwaInstallStateSnapshot {
  return {
    initialized: false,
    installability: 'unsupported',
    installMethod: 'none',
    blockedReason: 'missing-browser-support',
    dismissedInstallPrompt: isPwaInstallBannerDismissed(),
    updateAvailable: false,
    registrationFailed: false
  };
}

export const usePwaStore = create<PwaInstallStateSnapshot>(() => createInitialPwaState());
