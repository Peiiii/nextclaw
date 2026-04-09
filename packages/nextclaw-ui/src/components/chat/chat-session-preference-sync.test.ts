import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateNcpSession } from '@/api/ncp-session';
import { ChatSessionPreferenceSync } from '@/components/chat/chat-session-preference-sync';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

vi.mock('@/api/ncp-session', () => ({
  updateNcpSession: vi.fn(async () => ({
    sessionId: 'session-1',
    messageCount: 0,
    updatedAt: new Date().toISOString(),
    status: 'idle',
    metadata: {}
  }))
}));

describe('ChatSessionPreferenceSync', () => {
  afterEach(() => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        selectedModel: '',
        selectedThinkingLevel: null
      }
    }));
    useChatSessionListStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        selectedSessionKey: null
      }
    }));
    useChatThreadStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        canDeleteSession: false
      }
    }));
    vi.clearAllMocks();
  });

  it('persists the selected model and thinking to the current session metadata', async () => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        selectedModel: 'openai/gpt-5',
        selectedThinkingLevel: 'high'
      }
    }));
    useChatSessionListStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        selectedSessionKey: 'session-1'
      }
    }));
    useChatThreadStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        canDeleteSession: true
      }
    }));

    const sync = new ChatSessionPreferenceSync(updateNcpSession);
    sync.syncSelectedSessionPreferences();
    await vi.waitFor(() => {
      expect(updateNcpSession).toHaveBeenCalledWith('session-1', {
        preferredModel: 'openai/gpt-5',
        preferredThinking: 'high'
      });
    });
  });
});
