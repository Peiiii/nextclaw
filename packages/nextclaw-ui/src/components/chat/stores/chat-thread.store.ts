import { create } from 'zustand';
import type { MutableRefObject } from 'react';
import type { NcpMessage } from '@nextclaw/ncp';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import type { AgentProfileView } from '@/api/types';

export type ChatChildSessionTab = {
  sessionKey: string;
  parentSessionKey: string | null;
  label?: string | null;
  agentId?: string | null;
};

export type ChatThreadSnapshot = {
  isProviderStateResolved: boolean;
  modelOptions: ChatModelOption[];
  sessionTypeUnavailable: boolean;
  sessionTypeUnavailableMessage?: string | null;
  sessionTypeLabel?: string | null;
  sessionKey: string | null;
  agentId?: string | null;
  agentDisplayName?: string | null;
  agentAvatarUrl?: string | null;
  availableAgents?: AgentProfileView[];
  sessionDisplayName?: string;
  sessionProjectRoot?: string | null;
  sessionProjectName?: string | null;
  canDeleteSession: boolean;
  isDeletePending: boolean;
  threadRef: MutableRefObject<HTMLDivElement | null> | null;
  isHistoryLoading: boolean;
  messages: readonly NcpMessage[];
  isSending: boolean;
  isAwaitingAssistantOutput: boolean;
  parentSessionKey?: string | null;
  parentSessionLabel?: string | null;
  childSessionPanelParentKey?: string | null;
  childSessionTabs: ChatChildSessionTab[];
  activeChildSessionKey?: string | null;
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
  sessionTypeLabel: null,
  sessionKey: null,
  agentId: null,
  agentDisplayName: null,
  agentAvatarUrl: null,
  availableAgents: [],
  sessionDisplayName: undefined,
  sessionProjectRoot: null,
  sessionProjectName: null,
  canDeleteSession: false,
  isDeletePending: false,
  threadRef: null,
  isHistoryLoading: false,
  messages: [],
  isSending: false,
  isAwaitingAssistantOutput: false,
  parentSessionKey: null,
  parentSessionLabel: null,
  childSessionPanelParentKey: null,
  childSessionTabs: [],
  activeChildSessionKey: null,
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
