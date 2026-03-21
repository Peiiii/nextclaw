import { create } from 'zustand';

export type AccountPendingAction =
  | {
      type: 'enable-remote';
    }
  | null;

type AccountStoreState = {
  panelOpen: boolean;
  authSessionId: string | null;
  authVerificationUri: string | null;
  authExpiresAt: string | null;
  authStatusMessage: string;
  authPollIntervalMs: number;
  pendingAction: AccountPendingAction;
  openPanel: () => void;
  closePanel: () => void;
  setPendingAction: (next: AccountPendingAction) => void;
  clearPendingAction: () => void;
  beginBrowserAuth: (payload: {
    sessionId: string;
    verificationUri: string;
    expiresAt: string;
    intervalMs: number;
    statusMessage: string;
  }) => void;
  updateBrowserAuth: (patch: { statusMessage?: string; intervalMs?: number }) => void;
  clearBrowserAuth: () => void;
  setAuthStatusMessage: (message: string) => void;
};

export const useAccountStore = create<AccountStoreState>((set) => ({
  panelOpen: false,
  authSessionId: null,
  authVerificationUri: null,
  authExpiresAt: null,
  authStatusMessage: '',
  authPollIntervalMs: 1500,
  pendingAction: null,
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  setPendingAction: (next) => set({ pendingAction: next }),
  clearPendingAction: () => set({ pendingAction: null }),
  beginBrowserAuth: ({ sessionId, verificationUri, expiresAt, intervalMs, statusMessage }) =>
    set({
      panelOpen: true,
      authSessionId: sessionId,
      authVerificationUri: verificationUri,
      authExpiresAt: expiresAt,
      authPollIntervalMs: intervalMs,
      authStatusMessage: statusMessage
    }),
  updateBrowserAuth: ({ statusMessage, intervalMs }) =>
    set((state) => ({
      authStatusMessage: statusMessage ?? state.authStatusMessage,
      authPollIntervalMs: intervalMs ?? state.authPollIntervalMs
    })),
  clearBrowserAuth: () =>
    set({
      authSessionId: null,
      authVerificationUri: null,
      authExpiresAt: null,
      authStatusMessage: '',
      authPollIntervalMs: 1500
    }),
  setAuthStatusMessage: (message) => set({ authStatusMessage: message })
}));
