import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_NEW_SESSION_DRAFT_KEY,
  resolveChatComposerDraftKey,
  useChatComposerDraftStore,
  type ChatComposerDraftSnapshot,
} from '@/features/chat/stores/chat-composer-draft.store';

const STORAGE_KEY = 'nextclaw.chat.composer-drafts';

const EMPTY_DRAFT: ChatComposerDraftSnapshot = {
  text: '',
  nodes: [],
  selectedSkills: [],
  skillRecords: [],
  attachments: [],
  selectedModel: undefined,
  selectedThinkingLevel: null,
  pendingSessionType: 'native',
  selectedSessionType: 'native',
  composerFocusRequestId: 0,
  sendError: null,
};

describe('chat composer draft store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatComposerDraftStore.setState({ drafts: {} });
  });

  it('uses one fixed partition for the uncreated session', () => {
    expect(resolveChatComposerDraftKey(null)).toBe(CHAT_NEW_SESSION_DRAFT_KEY);
    expect(resolveChatComposerDraftKey('  ')).toBe(CHAT_NEW_SESSION_DRAFT_KEY);
    expect(resolveChatComposerDraftKey('session-a')).toBe('session:session-a');
  });

  it('restores persisted drafts after the store rehydrates', async () => {
    useChatComposerDraftStore.getState().updateDraft(
      'session:session-a',
      EMPTY_DRAFT,
      (snapshot) => ({ ...snapshot, text: '会话 A 草稿' }),
    );
    const persistedDrafts = window.localStorage.getItem(STORAGE_KEY);

    expect(persistedDrafts).not.toBeNull();
    useChatComposerDraftStore.setState({ drafts: {} });
    window.localStorage.setItem(STORAGE_KEY, persistedDrafts!);
    await useChatComposerDraftStore.persist.rehydrate();

    expect(
      useChatComposerDraftStore.getState().drafts['session:session-a']?.text,
    ).toBe('会话 A 草稿');
  });
});
