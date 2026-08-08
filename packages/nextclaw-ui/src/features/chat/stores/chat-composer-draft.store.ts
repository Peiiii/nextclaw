import type { ChatComposerNode } from '@nextclaw/agent-chat-ui';
import type { NcpDraftAttachment } from '@nextclaw/ncp-react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ThinkingLevel } from '@/shared/lib/api';

export const CHAT_NEW_SESSION_DRAFT_KEY = 'new-session';

type ChatComposerDraftSkillSelection = {
  readonly ref: string;
  readonly name: string;
};

export type ChatComposerDraftSnapshot = {
  readonly text: string;
  readonly nodes: readonly ChatComposerNode[];
  readonly selectedSkills: readonly string[];
  readonly skillRecords: readonly ChatComposerDraftSkillSelection[];
  readonly attachments: readonly NcpDraftAttachment[];
  readonly selectedModel: string | null | undefined;
  readonly selectedThinkingLevel: ThinkingLevel | null;
  readonly pendingSessionType: string;
  readonly selectedSessionType: string | null;
  readonly composerFocusRequestId: number;
  readonly sendError: string | null;
};

type ChatComposerDraftStore = {
  drafts: Record<string, ChatComposerDraftSnapshot>;
  ensureDraft: (draftKey: string, initialSnapshot: ChatComposerDraftSnapshot) => void;
  updateDraft: (
    draftKey: string,
    initialSnapshot: ChatComposerDraftSnapshot,
    update: (
      snapshot: ChatComposerDraftSnapshot,
    ) => ChatComposerDraftSnapshot,
  ) => void;
};

const CHAT_COMPOSER_DRAFT_STORAGE_KEY = 'nextclaw.chat.composer-drafts';
const CHAT_COMPOSER_DRAFT_STORAGE_VERSION = 1;

export function resolveChatComposerDraftKey(sessionKey: string | null): string {
  const normalizedSessionKey = sessionKey?.trim();
  return normalizedSessionKey
    ? `session:${normalizedSessionKey}`
    : CHAT_NEW_SESSION_DRAFT_KEY;
}

export const useChatComposerDraftStore = create<ChatComposerDraftStore>()(
  persist(
    (set) => ({
      drafts: {},
      ensureDraft: (draftKey, initialSnapshot) => {
        set((state) => state.drafts[draftKey]
          ? state
          : {
              drafts: {
                ...state.drafts,
                [draftKey]: initialSnapshot,
              },
            });
      },
      updateDraft: (draftKey, initialSnapshot, update) => {
        set((state) => ({
          drafts: {
            ...state.drafts,
            [draftKey]: update(state.drafts[draftKey] ?? initialSnapshot),
          },
        }));
      },
    }),
    {
      name: CHAT_COMPOSER_DRAFT_STORAGE_KEY,
      version: CHAT_COMPOSER_DRAFT_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        drafts: Object.fromEntries(
          Object.entries(state.drafts).map(([draftKey, snapshot]) => [
            draftKey,
            {
              ...snapshot,
              composerFocusRequestId: 0,
              sendError: null,
            },
          ]),
        ),
      }),
    },
  ),
);
