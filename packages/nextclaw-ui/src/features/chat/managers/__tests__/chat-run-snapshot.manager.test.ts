import type { NcpMessage } from '@nextclaw/ncp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatRunManager } from '@/features/chat/managers/chat-run.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

function createChatRunManager() {
  const uiManager = {
    isAtChatRoot: vi.fn(() => true),
    goToSession: vi.fn(),
  };
  return new ChatRunManager(
    uiManager as unknown as ConstructorParameters<typeof ChatRunManager>[0],
  );
}

describe('ChatRunManager run snapshots', () => {
  beforeEach(() => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        canStopGeneration: false,
        sendError: null,
        isSending: false,
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: null,
        isHistoryLoading: false,
        messages: [],
        isSending: false,
        isAwaitingAssistantOutput: false,
        contextWindow: null,
      },
    });
  });

  it('syncs the run snapshot into chat input and thread state', () => {
    const manager = createChatRunManager();
    const message: NcpMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'assistant',
      status: 'final',
      parts: [{ type: 'text', text: 'done' }],
      timestamp: '2026-06-10T00:00:00.000Z',
    };

    manager.applyRunSnapshot({
      routeSessionKey: 'session-1',
      isHydrating: true,
      isSending: false,
      isRunning: true,
      visibleMessages: [message],
      contextWindow: {
        usedContextTokens: 10,
        totalContextTokens: 100,
        availableContextTokens: 90,
        prunedUsedContextTokens: 10,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedUsedContextTokens: 10,
        compactedMessageCount: 0,
        updatedAt: '2026-06-10T00:00:00.000Z',
      },
      sendErrorMessage: 'failed',
      materializedSessionKey: null,
    });

    expect(useChatInputStore.getState().snapshot).toMatchObject({
      canStopGeneration: true,
      sendError: 'failed',
      isSending: true,
    });
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      sessionKey: 'session-1',
      isHistoryLoading: true,
      messages: [message],
      isSending: true,
      isAwaitingAssistantOutput: true,
      contextWindow: {
        usedContextTokens: 10,
        totalContextTokens: 100,
      },
    });
  });

  it('resets stale context window state when switching sessions', () => {
    const manager = createChatRunManager();
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-previous',
      contextWindow: {
        usedContextTokens: 80,
        totalContextTokens: 100,
        availableContextTokens: 20,
        prunedUsedContextTokens: 80,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedUsedContextTokens: 80,
        compactedMessageCount: 0,
        updatedAt: '2026-06-10T00:00:00.000Z',
      },
    });

    manager.applyRunSnapshot({
      routeSessionKey: 'session-next',
      isHydrating: true,
      isSending: false,
      isRunning: false,
      visibleMessages: [],
      contextWindow: null,
      sendErrorMessage: null,
      materializedSessionKey: null,
    });

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      sessionKey: 'session-next',
      contextWindow: null,
    });
  });
});
