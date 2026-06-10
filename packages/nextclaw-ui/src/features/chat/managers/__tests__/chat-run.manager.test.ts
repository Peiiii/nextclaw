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
  return {
    manager: new ChatRunManager(
      uiManager as unknown as ConstructorParameters<typeof ChatRunManager>[0],
    ),
    uiManager,
  };
}

describe('ChatRunManager', () => {
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
        isHistoryLoading: false,
        messages: [],
        isSending: false,
        isAwaitingAssistantOutput: false,
        contextWindow: null,
      },
    });
  });

  it('sends an envelope through the active runtime and materializes a root session', async () => {
    const { manager, uiManager } = createChatRunManager();
    const sendEnvelope = vi.fn(async () => ({
      sessionId: 'materialized-session',
      userMessageId: 'user-message-1',
      assistantMessageId: null,
      runId: 'run-1',
    }));
    manager.setActiveRuntime({
      sessionKey: null,
      sendEnvelope,
      abortCurrentRun: vi.fn(),
      resumeCurrentSessionRun: vi.fn(),
    });

    await manager.sendMessage({
      message: 'hello',
      agentId: 'engineer',
      sessionType: 'codex',
      projectRoot: '/tmp/project-alpha',
      requestedSkills: ['project:/tmp/project-alpha/.agents/skills/review'],
    });

    expect(sendEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentId: 'engineer',
          session_type: 'codex',
          projectRoot: '/tmp/project-alpha',
          requested_skill_refs: ['project:/tmp/project-alpha/.agents/skills/review'],
        }),
      }),
    );
    expect(uiManager.goToSession).toHaveBeenCalledWith('materialized-session', { replace: true });
  });

  it('does not send through a runtime for another session', async () => {
    const { manager } = createChatRunManager();
    const sendEnvelope = vi.fn();
    manager.setActiveRuntime({
      sessionKey: 'session-1',
      sendEnvelope,
      abortCurrentRun: vi.fn(),
      resumeCurrentSessionRun: vi.fn(),
    });

    await manager.sendMessage({
      message: 'hello',
      sessionKey: 'session-2',
      agentId: 'main',
    });

    expect(sendEnvelope).not.toHaveBeenCalled();
  });

  it('routes stop and resume commands through the active runtime', async () => {
    const { manager } = createChatRunManager();
    const abortCurrentRun = vi.fn(async () => undefined);
    const resumeCurrentSessionRun = vi.fn(async () => undefined);
    manager.setActiveRuntime({
      sessionKey: 'session-1',
      sendEnvelope: vi.fn(),
      abortCurrentRun,
      resumeCurrentSessionRun,
    });

    await manager.stopCurrentRun();
    await manager.resumeRun({ sessionKey: 'session-1' });
    await manager.resumeRun({ sessionKey: 'session-2' });

    expect(abortCurrentRun).toHaveBeenCalledTimes(1);
    expect(resumeCurrentSessionRun).toHaveBeenCalledTimes(1);
  });

  it('syncs the run snapshot into chat input and thread state', () => {
    const { manager } = createChatRunManager();
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
      isHistoryLoading: true,
      messages: [message],
      isSending: true,
      isAwaitingAssistantOutput: true,
    });
  });

  it('clears run-owned input and thread state', () => {
    const { manager } = createChatRunManager();
    useChatInputStore.getState().setSnapshot({
      canStopGeneration: true,
      sendError: 'failed',
      isSending: true,
    });
    useChatThreadStore.getState().setSnapshot({
      isHistoryLoading: true,
      messages: [
        {
          id: 'message-1',
          sessionId: 'session-1',
          role: 'assistant',
          status: 'final',
          parts: [{ type: 'text', text: 'done' }],
          timestamp: '2026-06-10T00:00:00.000Z',
        },
      ],
      isSending: true,
      isAwaitingAssistantOutput: true,
    });

    manager.clearRunState();

    expect(useChatInputStore.getState().snapshot).toMatchObject({
      canStopGeneration: false,
      sendError: null,
      isSending: false,
    });
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      isHistoryLoading: false,
      messages: [],
      isSending: false,
      isAwaitingAssistantOutput: false,
      contextWindow: null,
    });
  });
});
