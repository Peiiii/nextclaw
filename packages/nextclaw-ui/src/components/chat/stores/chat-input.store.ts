import { create } from 'zustand';
import type { MarketplaceInstalledRecord } from '@/api/types';

export type ChatInputSnapshot = {
  isProviderStateResolved: boolean;
  draft: string;
  pendingSessionType: string;
  defaultSessionType: string;
  canStopGeneration: boolean;
  stopDisabledReason: string | null;
  sendError: string | null;
  isSending: boolean;
  modelOptions: Array<{ value: string; modelLabel: string; providerLabel: string }>;
  selectedModel: string;
  sessionTypeOptions: Array<{ value: string; label: string }>;
  selectedSessionType?: string;
  stopSupported: boolean;
  stopReason?: string;
  canEditSessionType: boolean;
  sessionTypeUnavailable: boolean;
  skillRecords: MarketplaceInstalledRecord[];
  isSkillsLoading: boolean;
  selectedSkills: string[];
};

type ChatInputStore = {
  snapshot: ChatInputSnapshot;
  setSnapshot: (patch: Partial<ChatInputSnapshot>) => void;
};

const initialSnapshot: ChatInputSnapshot = {
  isProviderStateResolved: false,
  draft: '',
  pendingSessionType: 'native',
  defaultSessionType: 'native',
  canStopGeneration: false,
  stopDisabledReason: null,
  sendError: null,
  isSending: false,
  modelOptions: [],
  selectedModel: '',
  sessionTypeOptions: [],
  selectedSessionType: undefined,
  stopSupported: false,
  stopReason: undefined,
  canEditSessionType: false,
  sessionTypeUnavailable: false,
  skillRecords: [],
  isSkillsLoading: false,
  selectedSkills: []
};

export const useChatInputStore = create<ChatInputStore>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        ...patch
      }
    }))
}));
