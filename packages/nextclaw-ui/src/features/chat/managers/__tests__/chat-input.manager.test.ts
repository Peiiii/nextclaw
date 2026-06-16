import { createChatComposerTextNode } from '@nextclaw/agent-chat-ui';
import { RUNTIME_DEFAULT_MODEL_VALUE } from '@nextclaw/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputManager } from '@/features/chat/managers/chat-input.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import { useSystemStatusStore } from '@/features/system-status';

function resetChatInputManagerStoreState() {
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

describe('ChatInputManager', () => {
  beforeEach(resetChatInputManagerStoreState);

  it('sends through the current thread session when selected session state is stale', async () => {
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(chatRunManager.sendMessage).toHaveBeenCalledTimes(1);
    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: 'current-route-session',
        message: 'hello from current thread',
      }),
    );
    expect(sessionListManager.ensureDraftSession).not.toHaveBeenCalled();
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
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'materialized-draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(sessionListManager.ensureDraftSession).toHaveBeenCalledWith('native');
    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.not.objectContaining({
        sessionKey: expect.any(String),
      }),
    );
    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'hello from current thread',
      }),
    );
  });

  it('uses the default workspace as the project root for a blank draft send', async () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultProjectRoot: '/Users/demo/.nextclaw/workspace',
      },
    });
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
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'materialized-draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/Users/demo/.nextclaw/workspace',
      }),
    );
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
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(chatRunManager.sendMessage).not.toHaveBeenCalled();
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
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(chatRunManager.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('includes the current thread project root in the run payload', async () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'current-route-session',
        sessionProjectRoot: '/tmp/project-alpha',
      },
    });
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );

    await manager.send();

    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: '/tmp/project-alpha',
      }),
    );
  });

  it('restores the composer when sending through the run manager fails', async () => {
    const chatRunManager = {
      sendMessage: vi.fn().mockRejectedValue(new Error('send failed')),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(
      chatRunManager,
      sessionListManager,
    );
    const originalComposerNodes = useChatInputStore.getState().snapshot.composerNodes;

    await expect(manager.send()).rejects.toThrow('send failed');

    expect(useChatInputStore.getState().snapshot.draft).toBe('hello from current thread');
    expect(useChatInputStore.getState().snapshot.composerNodes).toEqual(originalComposerNodes);
  });

  it('creates and consumes one-shot composer focus requests', () => {
    const manager = new ChatInputManager(
      {} as ConstructorParameters<typeof ChatInputManager>[0],
      {} as ConstructorParameters<typeof ChatInputManager>[1],
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

describe('ChatInputManager configuration sync', () => {
  beforeEach(resetChatInputManagerStoreState);

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
    const manager = new ChatInputManager(
      {} as ConstructorParameters<typeof ChatInputManager>[0],
      {} as ConstructorParameters<typeof ChatInputManager>[1],
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

  it('sends the runtime-default sentinel so the backend can ignore stale session model metadata', async () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        selectedSessionType: 'codex',
        selectedModel: RUNTIME_DEFAULT_MODEL_VALUE,
      },
    });
    const chatRunManager = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      stopCurrentRun: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[0];
    const sessionListManager = {
      ensureDraftSession: vi.fn(() => 'draft-session'),
    } as unknown as ConstructorParameters<typeof ChatInputManager>[1];
    const manager = new ChatInputManager(chatRunManager, sessionListManager);

    await manager.send();

    expect(chatRunManager.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionType: 'codex',
        model: RUNTIME_DEFAULT_MODEL_VALUE,
      }),
    );
  });

  it('resolves and clears pending project root overrides inside the input manager', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        pendingProjectRoot: '/tmp/project-alpha',
        pendingProjectRootSessionKey: 'session-1',
      },
    });
    const manager = new ChatInputManager(
      {} as ConstructorParameters<typeof ChatInputManager>[0],
      {} as ConstructorParameters<typeof ChatInputManager>[1],
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
