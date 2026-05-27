import { create } from 'zustand';

type AccountStoreState = {
  panelOpen: boolean;
  authSessionId: string | null;
  authVerificationUri: string | null;
  authExpiresAt: string | null;
  authStatusMessage: string;
  authPollIntervalMs: number;
  openPanel: () => void;
  closePanel: () => void;
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
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
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
