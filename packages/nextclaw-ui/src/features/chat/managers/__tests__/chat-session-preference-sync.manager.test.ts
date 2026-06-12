import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateNcpSession } from '@/shared/lib/api';
import { ChatSessionPreferenceSync } from '@/features/chat/managers/chat-session-preference-sync.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type * as SharedApiModule from '@/shared/lib/api';

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApiModule>();
  return {
    ...actual,
    updateNcpSession: vi.fn(async () => ({
      sessionId: 'session-1',
      messageCount: 0,
      updatedAt: new Date().toISOString(),
      status: 'idle',
      metadata: {}
    }))
  };
});

describe('ChatSessionPreferenceSync', () => {
  afterEach(() => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        modelOptions: [],
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

  it('does not rewrite the input snapshot when the resolved selection is unchanged', () => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        modelOptions: [
          {
            value: 'openai/gpt-5',
            modelLabel: 'GPT-5',
            providerLabel: 'OpenAI',
            thinkingCapability: null,
          },
        ],
        selectedModel: 'openai/gpt-5',
        selectedThinkingLevel: null,
      }
    }));
    const sync = new ChatSessionPreferenceSync(updateNcpSession);
    const listener = vi.fn();
    const unsubscribe = useChatInputStore.subscribe(listener);

    sync.syncInputSelection({
      selectedSessionExists: true,
      selectedSessionPreferredModel: 'openai/gpt-5',
      selectedSessionPreferredThinking: null,
    });

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
  });

  it('applies a historical session preferred model after its summary arrives', () => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        modelOptions: [
          {
            value: 'anthropic/claude-sonnet-4',
            modelLabel: 'Claude Sonnet 4',
            providerLabel: 'Anthropic',
            thinkingCapability: null,
          },
          {
            value: 'openai/gpt-5',
            modelLabel: 'GPT-5',
            providerLabel: 'OpenAI',
            thinkingCapability: null,
          },
        ],
        selectedModel: 'anthropic/claude-sonnet-4',
        selectedThinkingLevel: null,
      }
    }));
    const sync = new ChatSessionPreferenceSync(updateNcpSession);

    sync.syncInputSelection({
      selectedSessionKey: 'session-2',
      selectedSessionExists: false,
      fallbackPreferredModel: 'anthropic/claude-sonnet-4',
    });
    expect(useChatInputStore.getState().snapshot.selectedModel).toBe(
      'anthropic/claude-sonnet-4',
    );

    sync.syncInputSelection({
      selectedSessionKey: 'session-2',
      selectedSessionExists: true,
      selectedSessionPreferredModel: 'openai/gpt-5',
      selectedSessionPreferredThinking: null,
      fallbackPreferredModel: 'anthropic/claude-sonnet-4',
    });

    expect(useChatInputStore.getState().snapshot.selectedModel).toBe('openai/gpt-5');
  });
});
