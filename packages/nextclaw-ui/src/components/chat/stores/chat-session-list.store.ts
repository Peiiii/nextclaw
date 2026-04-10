import { create, type StateCreator } from 'zustand';
import { createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';
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
  updatedAt: string | null | undefined,
  readUpdatedAt: string | undefined,
): boolean {
  const normalizedUpdatedAt = updatedAt?.trim();
  if (!normalizedUpdatedAt) {
    return false;
  }
  const normalizedReadUpdatedAt = readUpdatedAt?.trim();
  if (!normalizedReadUpdatedAt) {
    return true;
  }
  return normalizedUpdatedAt.localeCompare(normalizedReadUpdatedAt) > 0;
}

export function shouldShowUnreadSessionIndicator(params: {
  active: boolean;
  updatedAt: string | null | undefined;
  readUpdatedAt: string | undefined;
  runStatus?: SessionRunStatus;
}): boolean {
  const { active, readUpdatedAt, runStatus, updatedAt } = params;
  if (active || runStatus === 'running') {
    return false;
  }
  return hasUnreadSessionUpdate(updatedAt, readUpdatedAt);
}

type ChatSessionListStore = {
  snapshot: ChatSessionListSnapshot;
  readUpdatedAtBySessionKey: Record<string, string>;
  hasHydratedReadWatermarks: boolean;
  setSnapshot: (patch: Partial<ChatSessionListSnapshot>) => void;
  markSessionRead: (sessionKey: string, updatedAt: string | null | undefined) => void;
  hydrateReadWatermarks: (
    entries: readonly { sessionKey: string; updatedAt: string | null | undefined }[],
  ) => void;
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
  return (sessionKey: string, updatedAt: string | null | undefined) =>
    set((state) => {
      const normalizedSessionKey = sessionKey.trim();
      const normalizedUpdatedAt = updatedAt?.trim();
      if (!normalizedSessionKey || !normalizedUpdatedAt) {
        return state;
      }
      if (state.readUpdatedAtBySessionKey[normalizedSessionKey] === normalizedUpdatedAt) {
        return state;
      }
      return {
        ...state,
        readUpdatedAtBySessionKey: {
          ...state.readUpdatedAtBySessionKey,
          [normalizedSessionKey]: normalizedUpdatedAt
        }
      };
    });
}

function createHydrateReadWatermarksAction(set: ChatSessionListStoreSet) {
  return (
    entries: readonly { sessionKey: string; updatedAt: string | null | undefined }[],
  ) =>
    set((state) => {
      if (state.hasHydratedReadWatermarks) {
        return state;
      }
      const nextReadUpdatedAtBySessionKey = { ...state.readUpdatedAtBySessionKey };
      for (const entry of entries) {
        const normalizedSessionKey = entry.sessionKey.trim();
        const normalizedUpdatedAt = entry.updatedAt?.trim();
        if (!normalizedSessionKey || !normalizedUpdatedAt || nextReadUpdatedAtBySessionKey[normalizedSessionKey]) {
          continue;
        }
        nextReadUpdatedAtBySessionKey[normalizedSessionKey] = normalizedUpdatedAt;
      }
      return {
        ...state,
        hasHydratedReadWatermarks: true,
        readUpdatedAtBySessionKey: nextReadUpdatedAtBySessionKey
      };
    });
}

export const useChatSessionListStore = create<ChatSessionListStore>((set) => ({
  snapshot: initialSnapshot,
  readUpdatedAtBySessionKey: {},
  hasHydratedReadWatermarks: false,
  setSnapshot: createSetSnapshotAction(set),
  markSessionRead: createMarkSessionReadAction(set),
  hydrateReadWatermarks: createHydrateReadWatermarksAction(set)
}));
