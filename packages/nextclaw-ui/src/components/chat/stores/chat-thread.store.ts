import { create } from 'zustand';
import type { MutableRefObject } from 'react';
import type { UiMessage } from '@nextclaw/agent-chat';
import type { ChatModelOption } from '@/components/chat/chat-input.types';

export type ChatThreadSnapshot = {
  isProviderStateResolved: boolean;
  modelOptions: ChatModelOption[];
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage?: string | null;
  selectedSessionKey: string | null;
  sessionDisplayName?: string;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  threadRef: MutableRefObject<HTMLDivElement | null> | null;
  isHistoryLoading: boolean;
  uiMessages: UiMessage[];
  isSending: boolean;
  isAwaitingAssistantOutput: boolean;
};

type ChatThreadStore = {
  snapshot: ChatThreadSnapshot;
  setSnapshot: (patch: Partial<ChatThreadSnapshot>) => void;
};

const initialSnapshot: ChatThreadSnapshot = {
  isProviderStateResolved: false,
  modelOptions: [],
  sessionTypeUnavailable: false,
  sessionTypeUnavailableMessage: null,
  selectedSessionKey: null,
  sessionDisplayName: undefined,
  canDeleteSession: false,
  isDeletePending: false,
  threadRef: null,
  isHistoryLoading: false,
  uiMessages: [],
  isSending: false,
  isAwaitingAssistantOutput: false
};

export const useChatThreadStore = create<ChatThreadStore>((set) => ({
  snapshot: initialSnapshot,
  setSnapshot: (patch) =>
    set((state) => ({
      snapshot: {
        ...state.snapshot,
        ...patch
      }
    }))
}));
