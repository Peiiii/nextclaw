import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appQueryClient } from '@/app-query-client';
import { NcpChatThreadManager } from '@/components/chat/ncp/ncp-chat-thread.manager';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

const { deleteNcpSessionMock, deleteSummaryMock } = vi.hoisted(() => ({
  deleteNcpSessionMock: vi.fn(async () => ({ deleted: true, sessionId: 'parent-session-1' })),
  deleteSummaryMock: vi.fn(),
}));

vi.mock('@/api/ncp-session', () => ({
  deleteNcpSession: deleteNcpSessionMock,
}));

vi.mock('@/api/ncp-session-query-cache', () => ({
  deleteNcpSessionSummaryInQueryClient: deleteSummaryMock,
}));

describe('NcpChatThreadManager', () => {
  beforeEach(() => {
    useChatSessionListStore.setState({
      optimisticReadAtBySessionKey: {},
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'parent-session-1',
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'parent-session-1',
        childSessionPanelParentKey: null,
        childSessionTabs: [
          {
            sessionKey: 'child-session-1',
            parentSessionKey: 'parent-session-1',
            label: 'Child Session 1',
            agentId: 'reviewer',
          },
        ],
        activeChildSessionKey: null,
      },
    });
  });

  it('opens the child-session panel for the requested parent session and keeps focus on the chosen child', () => {
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });

    expect(useChatThreadStore.getState().snapshot.childSessionPanelParentKey).toBe('parent-session-1');
    expect(useChatThreadStore.getState().snapshot.activeChildSessionKey).toBe('child-session-1');
    expect(uiManager.goToSession).not.toHaveBeenCalled();
  });

  it('routes to the parent session before opening the child-session panel when needed', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'another-session',
      },
    });
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });

    expect(uiManager.goToSession).toHaveBeenCalledWith('parent-session-1');
  });

  it('clears the selected thread state after deleting the current session', async () => {
    const removeQueries = vi.spyOn(appQueryClient, 'removeQueries').mockImplementation(async () => undefined);
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(async () => true),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];
    const sessionListManager = {
      setSelectedSessionKey: vi.fn((value: string | null) => {
        useChatSessionListStore.getState().setSnapshot({
          selectedSessionKey: value,
        });
      }),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[1];
    const streamActionsManager = {
      resetStreamState: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[2];
    const manager = new NcpChatThreadManager(
      uiManager,
      sessionListManager,
      streamActionsManager,
    );

    await (manager as unknown as { deleteCurrentSession: () => Promise<void> }).deleteCurrentSession();

    expect(sessionListManager.setSelectedSessionKey).toHaveBeenCalledWith(null);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      sessionKey: null,
      canDeleteSession: false,
      messages: [],
      childSessionPanelParentKey: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
    });
    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(deleteSummaryMock).toHaveBeenCalledWith(appQueryClient, 'parent-session-1');
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ['ncp-session-messages', 'parent-session-1'],
    });
    expect(uiManager.goToChatRoot).toHaveBeenCalledWith({ replace: true });

    removeQueries.mockRestore();
  });
});
