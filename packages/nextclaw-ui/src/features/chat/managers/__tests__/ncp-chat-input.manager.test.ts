import { createChatComposerTextNode } from '@nextclaw/agent-chat-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NcpChatInputManager } from '@/features/chat/managers/ncp-chat-input.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { useSystemStatusStore } from '@/features/system-status';

function resetNcpChatInputManagerStoreState() {
  useChatInputStore.setState({
    snapshot: {
      ...useChatInputStore.getState().snapshot,
      draft: 'hello from current thread',
      composerNodes: [createChatComposerTextNode('hello from current thread')],
      attachments: [],
      selectedSkills: [],
      composerFocusRequest: null,
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
        extensionLoading: {
          state: 'ready',
          loadedExtensionCount: 1,
          totalExtensionCount: 1,
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
      selectedAgentId: 'main',
    },
  });
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getState().snapshot,
      sessionKey: 'current-route-session',
    },
  });
}

describe('NcpChatInputManager', () => {
  beforeEach(resetNcpChatInputManagerStoreState);

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

  it('creates and consumes one-shot composer focus requests', () => {
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      {} as ConstructorParameters<typeof NcpChatInputManager>[1],
      {} as ConstructorParameters<typeof NcpChatInputManager>[2],
    );

    manager.requestComposerFocusAtEnd();

    const request = useChatInputStore.getState().snapshot.composerFocusRequest;
    expect(request).toEqual({ id: 1, placement: 'end' });

    manager.consumeComposerFocusRequest(999);
    expect(useChatInputStore.getState().snapshot.composerFocusRequest).toEqual(request);

    manager.consumeComposerFocusRequest(request!.id);
    expect(useChatInputStore.getState().snapshot.composerFocusRequest).toBeNull();
  });
});

describe('NcpChatInputManager configuration sync', () => {
  beforeEach(resetNcpChatInputManagerStoreState);

  it('syncs session model and thinking preferences inside the input manager', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        modelOptions: [
          {
            value: 'anthropic/claude-sonnet-4',
            modelLabel: 'claude-sonnet-4',
            providerLabel: 'Anthropic',
            thinkingCapability: {
              supported: ['off', 'medium'],
              default: 'medium',
            },
          },
          {
            value: 'openai/gpt-5',
            modelLabel: 'gpt-5',
            providerLabel: 'OpenAI',
            thinkingCapability: {
              supported: ['off', 'high'],
              default: 'high',
            },
          },
        ],
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'session-1',
      },
    });
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      {} as ConstructorParameters<typeof NcpChatInputManager>[1],
      {} as ConstructorParameters<typeof NcpChatInputManager>[2],
    );

    manager.syncSessionPreferences({
      selectedSessionExists: true,
      selectedSessionPreferredModel: 'openai/gpt-5',
      selectedSessionPreferredThinking: 'high',
      fallbackPreferredModel: 'anthropic/claude-sonnet-4',
    });

    expect(useChatInputStore.getState().snapshot).toMatchObject({
      selectedModel: 'openai/gpt-5',
      selectedThinkingLevel: 'high',
    });
  });

  it('resolves and clears pending project root overrides inside the input manager', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        pendingProjectRoot: '/tmp/project-alpha',
        pendingProjectRootSessionKey: 'session-1',
      },
    });
    const manager = new NcpChatInputManager(
      {} as ConstructorParameters<typeof NcpChatInputManager>[0],
      {} as ConstructorParameters<typeof NcpChatInputManager>[1],
      {} as ConstructorParameters<typeof NcpChatInputManager>[2],
    );

    expect(
      manager.resolveProjectRootForSend({
        sessionKey: 'session-1',
        selectedSessionProjectRoot: '/tmp/server-project',
      }),
    ).toBe('/tmp/project-alpha');

    manager.clearPendingProjectRootOverrideForSession({
      sessionKey: 'session-1',
      selectedSessionProjectRoot: '/tmp/project-alpha',
    });

    expect(useChatInputStore.getState().snapshot).toMatchObject({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: null,
    });
  });
});
