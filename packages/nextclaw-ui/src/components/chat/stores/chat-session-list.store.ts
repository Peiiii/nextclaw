import { create } from 'zustand';
import { createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';

export type ChatSessionListMode = 'time-first' | 'project-first';

export type ChatSessionListSnapshot = {
  selectedSessionKey: string | null;
  draftSessionKey: string;
  selectedAgentId: string;
  query: string;
  listMode: ChatSessionListMode;
};

type ChatSessionListStore = {
  snapshot: ChatSessionListSnapshot;
  setSnapshot: (patch: Partial<ChatSessionListSnapshot>) => void;
};

const initialSnapshot: ChatSessionListSnapshot = {
  selectedSessionKey: null,
  draftSessionKey: createNcpSessionId(),
  selectedAgentId: 'main',
  query: '',
  listMode: 'time-first'
};

export const useChatSessionListStore = create<ChatSessionListStore>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        ...patch
      }
    }))
}));
