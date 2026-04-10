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
        pendingSessionType: 'native',
        pendingProjectRoot: null,
        pendingProjectRootSessionKey: null
      }
    });
    useChatSessionListStore.setState({
      readUpdatedAtBySessionKey: {},
      hasHydratedReadWatermarks: false,
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'session-1',
        draftSessionKey: 'draft-root-1',
        listMode: 'time-first'
      }
    });
  });

  it('applies the requested session type when creating a session', () => {
    const uiManager = {
      goToSession: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('codex');

    expect(streamActionsManager.resetStreamState).toHaveBeenCalledTimes(1);
    expect(uiManager.goToSession).toHaveBeenCalledWith('draft-root-1');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(useChatSessionListStore.getState().snapshot.draftSessionKey).not.toBe('draft-root-1');
    expect(useChatInputStore.getState().snapshot.pendingSessionType).toBe('codex');
    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBeNull();
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBeNull();
  });

  it('hydrates the draft project root when creating a session inside a project group', () => {
    const uiManager = {
      goToSession: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(useChatInputStore.getState().snapshot.pendingProjectRoot).toBe('/tmp/project-alpha');
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBe('draft-root-1');
  });

  it('promotes the current root draft when send flow needs a concrete session key', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
        draftSessionKey: 'draft-root-2'
      }
    });
    const uiManager = {
      goToSession: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    const sessionKey = manager.ensureDraftSession('native');

    expect(sessionKey).toBe('draft-root-2');
    expect(uiManager.goToSession).toHaveBeenCalledWith('draft-root-2');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
  });

  it('does not eagerly replace the old selected session before the route finishes switching', () => {
    const uiManager = {
      goToSession: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {
      resetStreamState: vi.fn()
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(useChatInputStore.getState().snapshot.pendingProjectRootSessionKey).toBe('draft-root-1');
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

  it('updates the sidebar list mode without touching other session list state', () => {
    const uiManager = {} as ConstructorParameters<typeof ChatSessionListManager>[0];
    const streamActionsManager = {} as ConstructorParameters<typeof ChatSessionListManager>[1];

    const manager = new ChatSessionListManager(uiManager, streamActionsManager);
    manager.setListMode('project-first');

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe('project-first');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
  });

  it('marks a session as read through the session list owner boundary', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
      {} as ConstructorParameters<typeof ChatSessionListManager>[1]
    );

    manager.markSessionRead('session-2', '2026-04-10T10:00:00.000Z');

    expect(useChatSessionListStore.getState().readUpdatedAtBySessionKey['session-2']).toBe(
      '2026-04-10T10:00:00.000Z'
    );
  });

  it('hydrates the initial unread baseline through the session list owner boundary', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0],
      {} as ConstructorParameters<typeof ChatSessionListManager>[1]
    );

    manager.hydrateReadWatermarks([
      {
        sessionKey: 'session-2',
        updatedAt: '2026-04-10T10:00:00.000Z'
      }
    ]);

    expect(useChatSessionListStore.getState().readUpdatedAtBySessionKey['session-2']).toBe(
      '2026-04-10T10:00:00.000Z'
    );
    expect(useChatSessionListStore.getState().hasHydratedReadWatermarks).toBe(true);
  });
});
