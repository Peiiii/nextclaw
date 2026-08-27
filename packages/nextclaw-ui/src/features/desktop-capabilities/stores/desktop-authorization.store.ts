import { create } from "zustand";
import type { CapabilityGrantRequestView } from "@nextclaw/client-sdk";

export type DesktopAuthorizationRequest = {
  applicationId: string;
  request: CapabilityGrantRequestView;
};

type DesktopAuthorizationState = {
  pending: DesktopAuthorizationRequest | null;
  present: (request: DesktopAuthorizationRequest) => void;
  clear: () => void;
};

export const useDesktopAuthorizationStore = create<DesktopAuthorizationState>(
  (set) => ({
    pending: null,
    present: (pending) => set({ pending }),
    clear: () => set({ pending: null }),
  }),
);
