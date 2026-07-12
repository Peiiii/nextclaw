import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedApi from '@/shared/lib/api';
import { ChatSessionListManager } from '@/features/chat/managers/chat-session-list.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

const chatSessionListModeStorageKey = 'nextclaw.chat.session-list.mode';
const persistStorage = new Map<string, unknown>();

function createLocalStoragePersistStorage() {
  return {
    getItem: (name: string) => persistStorage.get(name) ?? null,
    setItem: (name: string, value: unknown) => {
      persistStorage.set(name, value);
    },
    removeItem: (name: string) => {
      persistStorage.delete(name);
    },
  };
}

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

function resetChatSessionListManagerState() {
  persistStorage.clear();
  useChatSessionListStore.persist.setOptions({ storage: createLocalStoragePersistStorage() as never });
  useChatThreadStore.persist.setOptions({ storage: createLocalStoragePersistStorage() as never });
  mocks.updateNcpSession.mockReset();
  mocks.updateNcpSession.mockResolvedValue({});
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      selectedSessionKey: 'session-1',
      listMode: 'time-first',
      pinnedSessionKeys: [],
      pinnedProjectRoots: [],
      collapsedProjectRoots: [],
    }
  });
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getState().snapshot,
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'child-session-1',
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
      ],
      workspaceNavigationHistoryIndex: 0,
    },
  });
}

describe('ChatSessionListManager draft and selection flow', () => {
  beforeEach(resetChatSessionListManagerState);

  it('applies the requested session type when creating a session', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession('codex');

    expect(uiManager.navigateTo).toHaveBeenCalledWith('/chat/draft', {
      replace: true,
      state: {
        chatDraft: {
          sessionType: 'codex',
          projectRoot: null,
        },
      },
    });
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(false);
  });

  it('starts an agent draft chat through one owner state transition', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.startAgentDraftChat('researcher', 'codex');

    expect(uiManager.navigateTo).toHaveBeenCalledWith('/chat/draft', {
      replace: true,
      state: {
        chatDraft: {
          sessionType: 'codex',
          projectRoot: null,
        },
      },
    });
    expect(useChatSessionListStore.getState().snapshot.selectedAgentId).toBe('researcher');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.sessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot.hasSubmittedDraftMessage).toBe(false);
  });

  it('hydrates the draft project root when creating a session inside a project group', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(uiManager.navigateTo).toHaveBeenCalledWith('/chat/draft', {
      replace: true,
      state: {
        chatDraft: {
          sessionType: 'native',
          projectRoot: '/tmp/project-alpha',
        },
      },
    });
  });

  it('does not eagerly replace the old selected session before the route finishes switching', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.createSession('native', '/tmp/project-alpha');

    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(uiManager.navigateTo).toHaveBeenCalledWith('/chat/draft', expect.any(Object));
  });

  it('delegates existing-session selection to routing while preserving workspace panel state', () => {
    const uiManager = {
      goToChatRoot: vi.fn(),
      navigateTo: vi.fn(),
      goToSession: vi.fn(),
      isAtChatRoot: vi.fn(() => true),
    } as unknown as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.selectSession('session-2');

    expect(uiManager.goToSession).toHaveBeenCalledWith('session-2');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(useChatThreadStore.getState().snapshot.workspacePanelParentKey).toBe('session-1');
    expect(useChatThreadStore.getState().snapshot.activeWorkspacePanelKind).toBe('child-session');
    expect(useChatThreadStore.getState().snapshot.activeChildSessionKey).toBe('child-session-1');
    expect(useChatThreadStore.getState().snapshot.activeWorkspaceFileKey).toBeNull();
  });
});

describe('ChatSessionListManager list preference and read state', () => {
  beforeEach(resetChatSessionListManagerState);

  it('updates the sidebar list mode without touching other session list state', () => {
    const uiManager = {} as ConstructorParameters<typeof ChatSessionListManager>[0];

    const manager = new ChatSessionListManager(uiManager);
    manager.setListMode('project-first');

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe('project-first');
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBe('session-1');
    expect(persistStorage.get(chatSessionListModeStorageKey)).toMatchObject({
      state: {
        snapshot: {
          listMode: 'project-first'
        }
      }
    });
  });

  it('persists session and project list preferences through the list owner', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0]
    );

    manager.toggleSessionPinned('session-2');
    manager.toggleProjectPinned('/tmp/project-alpha');
    manager.toggleProjectCollapsed('/tmp/project-alpha');

    expect(useChatSessionListStore.getState().snapshot).toMatchObject({
      pinnedSessionKeys: ['session-2'],
      pinnedProjectRoots: ['/tmp/project-alpha'],
      collapsedProjectRoots: ['/tmp/project-alpha'],
    });
    expect(persistStorage.get(chatSessionListModeStorageKey)).toMatchObject({
      state: {
        snapshot: {
          pinnedSessionKeys: ['session-2'],
          pinnedProjectRoots: ['/tmp/project-alpha'],
          collapsedProjectRoots: ['/tmp/project-alpha'],
        },
      },
    });
  });

  it('marks a session as read through the session list owner boundary', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0]
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
      {} as ConstructorParameters<typeof ChatSessionListManager>[0]
    );

    manager.markSessionRead(
      'session-2',
      '2026-04-10T10:00:00.000Z',
      '2026-04-10T10:00:00.000Z'
    );

    expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['session-2']).toBeUndefined();
    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
  });

  it('marks a visible workspace child session as read through the session list owner', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0]
    );

    manager.markVisibleWorkspaceChildRead({
      sessionKey: 'child-session-1',
      lastMessageAt: '2026-04-10T10:00:00.000Z',
      readAt: null,
      runStatus: 'completed',
    });

    expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['child-session-1']).toBe(
      '2026-04-10T10:00:00.000Z'
    );
    expect(mocks.updateNcpSession).toHaveBeenCalledWith('child-session-1', {
      uiReadAt: '2026-04-10T10:00:00.000Z'
    });
  });

  it('keeps running workspace child sessions unread until they settle', () => {
    const manager = new ChatSessionListManager(
      {} as ConstructorParameters<typeof ChatSessionListManager>[0]
    );

    manager.markVisibleWorkspaceChildRead({
      sessionKey: 'child-session-1',
      lastMessageAt: '2026-04-10T10:00:00.000Z',
      readAt: null,
      runStatus: 'running',
    });

    expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['child-session-1']).toBeUndefined();
    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
  });

});

describe('ChatSessionListStore persistence', () => {
  beforeEach(() => {
    persistStorage.clear();
    useChatSessionListStore.persist.setOptions({ storage: createLocalStoragePersistStorage() as never });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: 'time-first',
        pinnedSessionKeys: [],
        pinnedProjectRoots: [],
        collapsedProjectRoots: [],
      }
    });
  });

  it('falls back to time-first when the persisted sidebar list mode is invalid', () => {
    useChatSessionListStore.persist.setOptions({
      storage: {
        getItem: () => ({ state: { snapshot: { listMode: 'sideways' } } }),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    });

    useChatSessionListStore.persist.rehydrate();

    expect(useChatSessionListStore.getState().snapshot.listMode).toBe('time-first');
  });

});
