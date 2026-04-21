import { create } from 'zustand';
import { isPwaInstallBannerDismissed } from '@/platforms/pwa/pwa-install-banner.utils';
import type { PwaInstallStateSnapshot } from '@/platforms/pwa/pwa.types';

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
