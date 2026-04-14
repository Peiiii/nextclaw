import { createChatComposerTextNode } from '@nextclaw/agent-chat-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NcpChatInputManager } from '@/components/chat/ncp/ncp-chat-input.manager';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

describe('NcpChatInputManager', () => {
  beforeEach(() => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        draft: 'hello from current thread',
        composerNodes: [createChatComposerTextNode('hello from current thread')],
        attachments: [],
        selectedSkills: [],
        selectedSessionType: 'native',
        selectedModel: '',
        selectedThinkingLevel: null,
      },
    });
    useChatSessionListStore.setState({
      optimisticReadAtBySessionKey: {},
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'stale-selected-session',
        draftSessionKey: 'draft-root-session',
        selectedAgentId: 'main',
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'current-route-session',
      },
    });
  });

  it('sends through the current thread session when selected session state is stale', async () => {
    const streamActionsManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[1];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
      promoteRootDraftSessionRoute: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[2];
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      streamActionsManager,
      sessionListManager,
    );

    await manager.send();

    expect(streamActionsManager.sendMessage).toHaveBeenCalledTimes(1);
    expect(streamActionsManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: 'current-route-session',
        message: 'hello from current thread',
      }),
    );
    expect(sessionListManager.ensureDraftSession).not.toHaveBeenCalled();
    expect(sessionListManager.promoteRootDraftSessionRoute).toHaveBeenCalledWith('current-route-session');
  });

  it('keeps sending through the current root draft session while /chat is still in blank-draft mode', async () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'draft-root-session',
      },
    });
    const streamActionsManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[1];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'materialized-draft-session'),
      promoteRootDraftSessionRoute: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[2];
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      streamActionsManager,
      sessionListManager,
    );

    await manager.send();

    expect(sessionListManager.ensureDraftSession).not.toHaveBeenCalled();
    expect(streamActionsManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: 'draft-root-session',
        message: 'hello from current thread',
      }),
    );
    expect(sessionListManager.promoteRootDraftSessionRoute).toHaveBeenCalledWith('draft-root-session');
  });
});
