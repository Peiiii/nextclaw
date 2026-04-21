export type PwaInstallabilityState = 'unsupported' | 'available' | 'installed' | 'suppressed';

export type PwaInstallMethod = 'prompt' | 'manual' | 'none';

export type PwaInstallBlockedReason =
  | 'desktop-host'
  | 'insecure-context'
  | 'missing-browser-support'
  | 'dev-server'
  | null;

export type PwaInstallPromptOutcome = 'accepted' | 'dismissed' | 'manual' | 'unavailable';

export interface PwaInstallStateSnapshot {
  initialized: boolean;
  installability: PwaInstallabilityState;
  installMethod: PwaInstallMethod;
  blockedReason: PwaInstallBlockedReason;
  dismissedInstallPrompt: boolean;
  updateAvailable: boolean;
  registrationFailed: boolean;
}
