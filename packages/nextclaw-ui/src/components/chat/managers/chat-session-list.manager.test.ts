import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';

describe('ChatSessionListManager', () => {
  beforeEach(() => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: 'native',
        pendingSessionType: 'native'
      }
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'session-1'
      }
    });
  });

  it('applies the requested session type when creating a session', () => {
    const uiManager = {
      goToChatRoot: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('codex');

    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(uiManager.goToChatRoot).toHaveBeenCalledTimes(1);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(useChatInputStore.getState().snapshot.pendingSessionType).toBe('codex');
  });

  it('delegates existing-session selection to routing without eagerly mutating the selected session state', () => {
    const uiManager = {
      goToSession: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.selectSession('session-2');

    expect(uiManager.goToSession).toHaveBeenCalledWith('session-2');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
  });
});
