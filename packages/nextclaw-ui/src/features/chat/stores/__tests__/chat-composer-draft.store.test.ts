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
    useChatComposerDraftStore.setState({ drafts: {}, submissions: {}, recentSubmittedNodes: {} });
  });

  const submittedNodes = [{ id: 'text-1', type: 'text' as const, text: 'sent text' }];
  const submission = {
    envelope: {
      sessionId: 'session-a',
      idempotencyKey: 'user-one',
      message: {
        id: 'user-one', sessionId: 'session-a', role: 'user' as const,
        status: 'final' as const, timestamp: '2026-09-24T00:00:00.000Z',
        parts: [{ type: 'text' as const, text: 'sent text' }],
      },
    },
    composer: { text: 'sent text', nodes: submittedNodes, attachments: [], selectedSkills: [], skillRecords: [] },
    status: 'sending' as const,
  };

  it('keeps submitted text out of the draft across late editor updates and acceptance', () => {
    const store = useChatComposerDraftStore.getState();
    const key = 'session:session-a';
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({ ...draft, ...submission.composer }));
    store.beginSubmission(key, EMPTY_DRAFT, submission);
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('');
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({
      ...draft, nodes: [{ ...submittedNodes[0]!, text: '' }], text: '',
    }));
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({ ...draft, ...submission.composer }));
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('');
    store.acceptSubmission(key, 'user-one');
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({ ...draft, ...submission.composer }));
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('');
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({
      ...draft, text: 'new input', nodes: [{ ...submittedNodes[0]!, text: 'new input' }],
    }));
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('new input');
  });

  it('persists an interrupted send separately from the composer draft', async () => {
    const store = useChatComposerDraftStore.getState();
    const key = 'session:session-a';
    store.beginSubmission(key, EMPTY_DRAFT, submission);
    const persisted = window.localStorage.getItem(STORAGE_KEY)!;
    useChatComposerDraftStore.setState({ drafts: {}, submissions: {}, recentSubmittedNodes: {} });
    window.localStorage.setItem(STORAGE_KEY, persisted);
    await useChatComposerDraftStore.persist.rehydrate();
    const restored = useChatComposerDraftStore.getState();
    expect(restored.drafts[key]?.text).toBe('');
    expect(restored.submissions[key]?.status).toBe('uncertain');
    expect(restored.submissions[key]?.envelope.message.id).toBe('user-one');
  });

  it('restores a rejected send only when it cannot overwrite newer input', () => {
    const store = useChatComposerDraftStore.getState();
    const key = 'session:session-a';
    store.beginSubmission(key, EMPTY_DRAFT, submission);
    store.failSubmission(key, 'user-one', 'rejected', 'rejected');
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('sent text');
    expect(useChatComposerDraftStore.getState().submissions[key]).toBeUndefined();

    store.beginSubmission(key, EMPTY_DRAFT, submission);
    store.updateDraft(key, EMPTY_DRAFT, (draft) => ({
      ...draft, text: 'new input', nodes: [{ ...submittedNodes[0]!, text: 'new input' }],
    }));
    store.failSubmission(key, 'user-one', 'rejected', 'rejected');
    expect(useChatComposerDraftStore.getState().drafts[key]?.text).toBe('new input');
    expect(useChatComposerDraftStore.getState().submissions[key]?.status).toBe('rejected');
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
