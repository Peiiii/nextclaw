import { createChatComposerTextNode } from '@nextclaw/agent-chat-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NcpChatInputManager } from '@/features/chat/managers/ncp-chat-input.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { useSystemStatusStore } from '@/features/system-status';

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
        selectedModel: 'gpt-5',
        selectedThinkingLevel: null,
        isProviderStateResolved: true,
        modelOptions: [
          {
            value: 'gpt-5',
            modelLabel: 'GPT-5',
            providerLabel: 'OpenAI',
            thinkingCapability: null,
          },
        ],
      },
    });
    useSystemStatusStore.setState({
      state: {
        ...useSystemStatusStore.getState().state,
        lifecyclePhase: 'ready',
        bootstrapStatus: {
          phase: 'ready',
          ncpAgent: {
            state: 'ready',
          },
          pluginHydration: {
            state: 'ready',
            loadedPluginCount: 1,
            totalPluginCount: 1,
          },
          channels: {
            state: 'ready',
            enabled: [],
          },
          remote: {
            state: 'pending',
          },
        },
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
      materializeRootSessionRoute: vi.fn(),
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
    expect(sessionListManager.materializeRootSessionRoute).not.toHaveBeenCalled();
  });

  it('sends without a session key while /chat is still in blank-draft mode', async () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: null,
      },
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
        draftSessionKey: null,
      },
    });
    const streamActionsManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[1];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'materialized-draft-session'),
      materializeRootSessionRoute: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[2];
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      streamActionsManager,
      sessionListManager,
    );

    await manager.send();

    expect(sessionListManager.ensureDraftSession).toHaveBeenCalledWith('native');
    expect(streamActionsManager.sendMessage).toHaveBeenCalledWith(
      expect.not.objectContaining({
        sessionKey: expect.any(String),
      }),
    );
    expect(streamActionsManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'hello from current thread',
      }),
    );
    expect(sessionListManager.materializeRootSessionRoute).not.toHaveBeenCalled();
  });

  it('does not send while the runtime is still blocked during startup', async () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        isProviderStateResolved: false,
        modelOptions: [],
      },
    });
    useSystemStatusStore.setState({
      state: {
        ...useSystemStatusStore.getState().state,
        lifecyclePhase: 'cold-starting',
        bootstrapStatus: {
          ...useSystemStatusStore.getState().state.bootstrapStatus!,
          phase: 'kernel-starting',
          ncpAgent: {
            state: 'pending',
          },
        },
      },
    });
    const streamActionsManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[1];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
      materializeRootSessionRoute: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[2];
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      streamActionsManager,
      sessionListManager,
    );

    await manager.send();

    expect(streamActionsManager.sendMessage).not.toHaveBeenCalled();
    expect(sessionListManager.materializeRootSessionRoute).not.toHaveBeenCalled();
  });

  it('still attempts to send when provider metadata is stale or the session type is marked unavailable', async () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        isProviderStateResolved: true,
        modelOptions: [],
        sessionTypeUnavailable: true,
      },
    });
    const streamActionsManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[1];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
      materializeRootSessionRoute: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatInputManager>[2];
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      streamActionsManager,
      sessionListManager,
    );

    await manager.send();

    expect(streamActionsManager.sendMessage).toHaveBeenCalledTimes(1);
    expect(sessionListManager.materializeRootSessionRoute).not.toHaveBeenCalled();
  });
});
