import { create, type StateCreator } from 'zustand';
import { createNcpSessionId } from '@/features/chat/utils/ncp-session-adapter.utils';
import type { SessionRunStatus } from '@/lib/session-run-status';
export type ChatSessionListMode = 'time-first' | 'project-first';
export type ChatSessionListSnapshot = {
  selectedSessionKey: string | null;
  draftSessionKey: string;
  selectedAgentId: string;
  query: string;
  listMode: ChatSessionListMode;
};

export function hasUnreadSessionUpdate(
  lastMessageAt: string | null | undefined,
  readAt: string | undefined,
): boolean {
  const normalizedLastMessageAt = lastMessageAt?.trim();
  if (!normalizedLastMessageAt) {
    return false;
  }
  const normalizedReadAt = readAt?.trim();
  if (!normalizedReadAt) {
    // Until this client establishes a read watermark, avoid guessing unread state.
    return false;
  }
  return normalizedLastMessageAt.localeCompare(normalizedReadAt) > 0;
}

export function shouldShowUnreadSessionIndicator(params: {
  active: boolean;
  lastMessageAt: string | null | undefined;
  readAt: string | undefined;
  runStatus?: SessionRunStatus;
}): boolean {
  const { active, readAt, runStatus, lastMessageAt } = params;
  if (active || runStatus === 'running') {
    return false;
  }
  return hasUnreadSessionUpdate(lastMessageAt, readAt);
}

type ChatSessionListStore = {
  snapshot: ChatSessionListSnapshot;
  optimisticReadAtBySessionKey: Record<string, string>;
  setSnapshot: (patch: Partial<ChatSessionListSnapshot>) => void;
  markSessionRead: (sessionKey: string, readAt: string | null | undefined) => void;
};

type ChatSessionListStoreSet = Parameters<StateCreator<ChatSessionListStore>>[0];

const initialSnapshot: ChatSessionListSnapshot = {
  selectedSessionKey: null,
  draftSessionKey: createNcpSessionId(),
  selectedAgentId: 'main',
  query: '',
  listMode: 'time-first'
};

function createSetSnapshotAction(set: ChatSessionListStoreSet) {
  return (patch: Partial<ChatSessionListSnapshot>) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        ...patch
      }
    }));
}

function createMarkSessionReadAction(set: ChatSessionListStoreSet) {
  return (sessionKey: string, readAt: string | null | undefined) =>
    set((state) => {
      const normalizedSessionKey = sessionKey.trim();
      const normalizedReadAt = readAt?.trim();
      if (!normalizedSessionKey || !normalizedReadAt) {
        return state;
      }
      const previousReadAt = state.optimisticReadAtBySessionKey[normalizedSessionKey];
      if (previousReadAt && previousReadAt.localeCompare(normalizedReadAt) >= 0) {
        return state;
      }
      return {
        ...state,
        optimisticReadAtBySessionKey: {
          ...state.optimisticReadAtBySessionKey,
          [normalizedSessionKey]: normalizedReadAt
        }
      };
    });
}

export const useChatSessionListStore = create<ChatSessionListStore>((set) => ({
  snapshot: initialSnapshot,
  optimisticReadAtBySessionKey: {},
  setSnapshot: createSetSnapshotAction(set),
  markSessionRead: createMarkSessionReadAction(set)
}));
