import { create } from "zustand";

import type {
  CompanionAgentProfile,
  CompanionAvatarView,
  CompanionOfflineReason,
  CompanionSessionSummary
} from "../types/companion.types.js";

export type CompanionRuntimeConnectionState = "loading" | "idle" | "running" | "offline";

export type CompanionRuntimeSnapshot = {
  baseUrl: string | null;
  agents: CompanionAgentProfile[];
  sessions: CompanionSessionSummary[];
  connectionState: CompanionRuntimeConnectionState;
  offlineReason: CompanionOfflineReason | null;
  currentView: CompanionAvatarView;
};

type CompanionRuntimeStoreState = {
  snapshot: CompanionRuntimeSnapshot;
  setSnapshot: (snapshot: CompanionRuntimeSnapshot) => void;
  reset: () => void;
};

export const createInitialCompanionRuntimeSnapshot = (
  baseUrl: string | null = null
): CompanionRuntimeSnapshot => ({
  baseUrl,
  agents: [],
  sessions: [],
  connectionState: "loading",
  offlineReason: null,
  currentView: {
    state: "idle",
    title: "NextClaw",
    subtitle: "Starting companion",
    openUrl: baseUrl ?? "http://127.0.0.1:55667"
  }
});

export const useCompanionRuntimeStore = create<CompanionRuntimeStoreState>((set) => ({
  snapshot: createInitialCompanionRuntimeSnapshot(),
  setSnapshot: (snapshot) => {
    set({ snapshot });
  },
  reset: () => {
    set({ snapshot: createInitialCompanionRuntimeSnapshot() });
  }
}));
