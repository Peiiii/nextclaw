import { create } from 'zustand';
import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import type { SessionSkillEntryView, SessionTypeIconView, ThinkingLevel } from '@/api/types';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { createInitialChatComposerNodes } from '@/features/chat/utils/chat-composer-state.utils';

export type ChatInputSnapshot = {
  isProviderStateResolved: boolean;
  composerNodes: ChatComposerNode[];
  attachments: NcpDraftAttachment[];
  draft: string;
  pendingSessionType: string;
  pendingProjectRoot: string | null;
  pendingProjectRootSessionKey: string | null;
  defaultSessionType: string;
  canStopGeneration: boolean;
  stopDisabledReason: string | null;
  sendError: string | null;
  isSending: boolean;
  modelOptions: ChatModelOption[];
  selectedModel: string;
  selectedThinkingLevel: ThinkingLevel | null;
  sessionTypeOptions: Array<{
    value: string;
    label: string;
    icon?: SessionTypeIconView | null;
    ready?: boolean;
    reason?: string | null;
    reasonMessage?: string | null;
    supportedModels?: string[];
    recommendedModel?: string | null;
    cta?: {
      kind: string;
      label?: string;
      href?: string;
    } | null;
  }>;
  selectedSessionType?: string;
  stopSupported: boolean;
  stopReason?: string;
  canEditSessionType: boolean;
  sessionTypeUnavailable: boolean;
  skillRecords: SessionSkillEntryView[];
  isSkillsLoading: boolean;
  selectedSkills: string[];
};

type ChatInputStore = {
  snapshot: ChatInputSnapshot;
  setSnapshot: (patch: Partial<ChatInputSnapshot>) => void;
};

const initialSnapshot: ChatInputSnapshot = {
  isProviderStateResolved: false,
  composerNodes: createInitialChatComposerNodes(),
  attachments: [],
  draft: '',
  pendingSessionType: 'native',
  pendingProjectRoot: null,
  pendingProjectRootSessionKey: null,
  defaultSessionType: 'native',
  canStopGeneration: false,
  stopDisabledReason: null,
  sendError: null,
  isSending: false,
  modelOptions: [],
  selectedModel: '',
  selectedThinkingLevel: null,
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
