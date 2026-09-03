import { create } from 'zustand';
import type { ServiceActionListView } from '@nextclaw/client-sdk';

type ServiceActionRisk = ServiceActionListView['actions'][number]['risk'];

export type PanelAppServiceActionAuthorizationItem = {
  actionId: string;
  actionTitle?: string;
  actionDescription?: string;
  risk?: ServiceActionRisk;
};

export type PanelAppServiceActionAuthorizationRequest = {
  id: string;
  panelAppId: string;
  actions: PanelAppServiceActionAuthorizationItem[];
  inputPreview?: string;
};

type PendingAuthorization = PanelAppServiceActionAuthorizationRequest & {
  resolve: (allowed: boolean) => void;
};

type ServiceActionAuthorizationState = {
  pending: PendingAuthorization | null;
  requestAuthorization: (
    request: Omit<PanelAppServiceActionAuthorizationRequest, 'id'>,
  ) => Promise<boolean>;
  resolveAuthorization: (allowed: boolean) => void;
};

function createAuthorizationId(): string {
  return `service-action-auth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const usePanelAppServiceActionAuthorizationStore = create<ServiceActionAuthorizationState>((set, get) => ({
  pending: null,
  requestAuthorization: async (request) =>
    await new Promise<boolean>((resolve) => {
      get().pending?.resolve(false);
      set({
        pending: {
          id: createAuthorizationId(),
          ...request,
          resolve,
        },
      });
    }),
  resolveAuthorization: (allowed) => {
    const { pending } = get();
    if (!pending) {
      return;
    }
    pending.resolve(allowed);
    set({ pending: null });
  },
}));
