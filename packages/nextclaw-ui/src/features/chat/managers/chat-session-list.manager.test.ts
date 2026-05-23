import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/lib/api';
import { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  updateNcpSession: vi.fn(),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    updateNcpSession: mocks.updateNcpSession,
  };
});

describe('ChatSessionListManager', () => {
  beforeEach(() => {
    mocks.updateNcpSession.mockReset();
    mocks.updateNcpSession.mockResolvedValue({});
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: 'native',
        pendingSessionType: 'native',
        pendingProjectRoot: null,
        pendingProjectRootSessionKey: null
      }
    });
    useChatSessionListStore.setState({
      optimisticReadAtBySessionKey: {},
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'session-1',
        listMode: 'time-first'
      }
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        workspacePanelParentKey: 'session-1',
        activeWorkspacePanelKind: 'child-session',
        activeChildSessionKey: 'child-session-1',
        activeWorkspaceFileKey: null,
      },
    });
  });

  it('applies the requested session type when creating a session', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('codex');

    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(uiManager.goToChatRoot).toHaveBeenCalledTimes(1);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(false);
    expect(useChatInputStore.getState().snapshot.pendingSessionType).toBe('codex');
    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBeNull();
  });

  it('starts an agent draft chat through one owner state transition', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.startAgentDraftChat('researcher', 'codex');

    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(uiManager.goToChatRoot).toHaveBeenCalledTimes(1);
    expect(useChatSessionListStore.getState().snapshot.selectedAgentId).toBe('researcher');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(false);
    expect(useChatInputStore.getState().snapshot.pendingSessionType).toBe('codex');
    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBeNull();
  });

  it('hydrates the draft project root when creating a session inside a project group', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBe('/tmp/project-alpha');
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBeNull();
  });

  it('keeps the root draft key empty when send flow has no concrete session yet', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null
      }
    });
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    const sessionKey = manager.ensureDraftSession('native');

    expect(sessionKey).toBeNull();
    expect(uiManager.goToChatRoot).not.toHaveBeenCalled();
    expect(uiManager.goToSession).not.toHaveBeenCalled();
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(true);
  });

  it('does not eagerly replace the old selected session before the route finishes switching', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBeNull();
  });

  it('delegates existing-session selection to routing while preserving workspace panel state', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.selectSession('session-2');

    expect(uiManager.goToSession).toHaveBeenCalledWith('session-2');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(useChatThreadStore.getState().snapshot.workspacePanelParentKey).toBe('session-1');
    expect(useChatThreadStore.getState().snapshot.activeWorkspacePanelKind).toBe('child-session');
    expect(useChatThreadStore.getState().snapshot.activeChildSessionKey).toBe('child-session-1');
    expect(useChatThreadStore.getState().snapshot.activeWorkspaceFileKey).toBeNull();
  });

  it('updates the sidebar list mode without touching other session list state', () => {
    const uiManager = {
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {} as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.setListMode('project-first');

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe('project-first');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
  });

  it('marks a session as read through the session list owner boundary', () => {
    const manager = new ChatSessionListManager(
      {
        isAtChatRoot: vi.fn(() => true),
      } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0],
      {} as ConstructorParameters<typeof ChatSessionListManager>[1]
    );

    manager.markSessionRead('session-2', '2026-04-10T10:00:00.000Z');

    expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['session-2']).toBe(
      '2026-04-10T10:00:00.000Z'
    );
    expect(mocks.updateNcpSession).toHaveBeenCalledWith('session-2', {
      uiReadAt: '2026-04-10T10:00:00.000Z'
    });
  });

  it('skips persisting read state when the backend already has the same watermark', () => {
    const manager = new ChatSessionListManager(
      {
        isAtChatRoot: vi.fn(() => true),
      } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0],
      {} as ConstructorParameters<typeof ChatSessionListManager>[1]
    );

    manager.markSessionRead(
      'session-2',
      '2026-04-10T10:00:00.000Z',
      '2026-04-10T10:00:00.000Z'
    );

    expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['session-2']).toBeUndefined();
    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
  });

  it('routes to the backend-materialized root session without duplicating route-owned selection state', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
      }
    });
    const uiManager = {
      goToChatRoot: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];
    const manager = new ChatSessionListManager(uiManager, streamActionsManager);

    manager.ensureDraftSession('native');
    manager.materializeRootSessionRoute('ncp-materialized-session');

    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(uiManager.goToSession).toHaveBeenCalledWith('ncp-materialized-session', { replace: true });
  });
});
