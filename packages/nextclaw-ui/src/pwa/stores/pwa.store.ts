import { create } from 'zustand';
import type { PwaInstallStateSnapshot } from '@/pwa/pwa.types';

export function createInitialPwaState(): PwaInstallStateSnapshot {
  return {
    initialized: false,
    installability: 'unsupported',
    installMethod: 'none',
    blockedReason: 'missing-browser-support',
    dismissedInstallPrompt: false,
    updateAvailable: false,
    registrationFailed: false
  };
}

export const usePwaStore = create<PwaInstallStateSnapshot>(() => createInitialPwaState());
