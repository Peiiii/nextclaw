import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionListManager } from '@/components/chat/managers/chat-session-list.manager';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  updateNcpSession: vi.fn(),
}));

vi.mock('@/api/ncp-session', () => ({
  updateNcpSession: mocks.updateNcpSession,
}));

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
        draftSessionKey: 'draft-root-1',
        listMode: 'time-first'
      }
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        workspacePanelParentKey: 'session-1',
        activeChildSessionKey: 'child-session-1',
        activeWorkspaceFileKey: 'session-1::/tmp/demo.md',
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
    const sessionKey = manager.createSession('codex');

    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(uiManager.goToChatRoot).toHaveBeenCalledTimes(1);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatSessionListStore.getState().snapshot.draftSessionKey).toBe(sessionKey);
    expect(useChatSessionListStore.getState().snapshot.draftSessionKey).not.toBe('draft-root-1');
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
    const sessionKey = manager.createSession('native', '/tmp/project-alpha');

    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBe('/tmp/project-alpha');
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBe(sessionKey);
  });

  it('reuses the current root draft when send flow needs a concrete session key', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
        draftSessionKey: 'draft-root-2'
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

    expect(sessionKey).toBe('draft-root-2');
    expect(uiManager.goToChatRoot).not.toHaveBeenCalled();
    expect(uiManager.goToSession).not.toHaveBeenCalled();
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
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
    const sessionKey = manager.createSession('native', '/tmp/project-alpha');

    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBe(sessionKey);
  });

  it('delegates existing-session selection to routing without eagerly mutating the selected session state', () => {
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
    expect(useChatThreadStore.getState().snapshot.workspacePanelParentKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.activeChildSessionKey).toBeNull();
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

  it('promotes the active root draft to a concrete session route after the draft has been sent successfully', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
        draftSessionKey: 'draft-root-2',
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
    manager.promoteRootDraftSessionRoute('draft-root-2');

    expect(uiManager.goToSession).toHaveBeenCalledWith('draft-root-2', { replace: true });
  });
});
