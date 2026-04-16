import { create } from 'zustand';
import { isPwaInstallBannerDismissed } from '@/pwa/pwa-install-banner.storage';
import type { PwaInstallStateSnapshot } from '@/pwa/pwa.types';

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
