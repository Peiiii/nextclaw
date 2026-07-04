import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appQueryClient } from '@/app-query-client';
import { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type * as SharedApi from '@/shared/lib/api';

const { deleteNcpSessionMock, deleteSummaryMock } = vi.hoisted(() => ({
  deleteNcpSessionMock: vi.fn(async () => ({ deleted: true, sessionId: 'parent-session-1' })),
  deleteSummaryMock: vi.fn(),
}));
const persistStorage = new Map<string, unknown>();

function createPersistStorage() {
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

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    deleteNcpSession: deleteNcpSessionMock,
    deleteNcpSessionSummaryInQueryClient: deleteSummaryMock,
  };
});

beforeEach(() => {
  persistStorage.clear();
  useChatSessionListStore.persist.setOptions({ storage: createPersistStorage() as never });
  useChatThreadStore.persist.setOptions({ storage: createPersistStorage() as never });
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
      workspacePanelParentKey: null,
      childSessionTabs: [
        {
          sessionKey: 'child-session-1',
          parentSessionKey: 'parent-session-1',
          label: 'Child Session 1',
          agentId: 'reviewer',
        },
      ],
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    },
  });
});

function createUiManager(
  overrides: Record<string, unknown> = {},
): ConstructorParameters<typeof ChatThreadManager>[0] {
  return {
    goToSession: vi.fn(),
    goToChatRoot: vi.fn(),
    goToProviders: vi.fn(),
    confirm: vi.fn(),
    isCompactViewport: vi.fn(() => false),
    showContent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];
}

describe('ChatThreadManager', () => {
  it('opens the child-session panel for the requested parent session and keeps focus on the chosen child', () => {
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];

    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });

    expect(useChatThreadStore.getState().snapshot.workspacePanelParentKey).toBe('parent-session-1');
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
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];

    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });

    expect(uiManager.goToSession).toHaveBeenCalledWith('parent-session-1');
  });

  it('opens the session cron panel without changing route when already selected', () => {
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];

    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openSessionCronPanel('parent-session-1');

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'cron',
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
    });
    expect(uiManager.goToSession).not.toHaveBeenCalled();
  });

  it('opens a side chat draft beside the selected parent session', () => {
    const uiManager = createUiManager({
      goToSession: vi.fn(),
    });
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openSideChatDraft('parent-session-1');

    const { snapshot } = useChatThreadStore.getState();
    expect(snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'side-chat-draft',
      activeChildSessionKey: null,
      activeWorkspaceFileKey: null,
      activeSideChatDraft: {
        parentSessionKey: 'parent-session-1',
      },
      workspaceNavigationHistoryIndex: 0,
    });
    expect(snapshot.activeSideChatDraft?.draftKey).toEqual(expect.any(String));
    expect(snapshot.workspaceNavigationHistory).toEqual([
      {
        kind: 'side-chat-draft',
        key: snapshot.activeSideChatDraft?.draftKey,
      },
    ]);
    expect(uiManager.goToSession).not.toHaveBeenCalled();
  });

  it('materializes an active side chat draft into a real child-session tab', () => {
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openSideChatDraft('parent-session-1');
    const draftKey = useChatThreadStore.getState().snapshot.activeSideChatDraft?.draftKey;
    expect(draftKey).toEqual(expect.any(String));

    manager.materializeSideChatDraft({
      draftKey: draftKey ?? '',
      sessionKey: 'child-session-side',
      label: 'Side chat',
      agentId: 'main',
    });

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'child-session-side',
      activeSideChatDraft: null,
      activeWorkspaceFileKey: null,
      childSessionTabs: [
        {
          sessionKey: 'child-session-side',
          parentSessionKey: 'parent-session-1',
          label: 'Side chat',
          agentId: 'main',
        },
        {
          sessionKey: 'child-session-1',
        },
      ],
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-side' },
      ],
      workspaceNavigationHistoryIndex: 0,
    });
  });

  it('routes to the session before opening its cron panel when needed', () => {
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
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];

    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openSessionCronPanel('parent-session-1');

    expect(uiManager.goToSession).toHaveBeenCalledWith('parent-session-1');
  });

  it('keeps preview and diff for the same file as separate workspace tabs', () => {
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];

    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openFilePreview({
      path: 'README.md',
      label: 'README.md',
      viewMode: 'preview',
    });
    manager.openFilePreview({
      path: 'README.md',
      label: 'README.md',
      viewMode: 'diff',
      beforeText: 'old\n',
      afterText: 'new\n',
    });

    expect(useChatThreadStore.getState().snapshot.workspaceFileTabs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'parent-session-1::preview::README.md',
          path: 'README.md',
          viewMode: 'preview',
        }),
        expect.objectContaining({
          key: 'parent-session-1::diff::README.md',
          path: 'README.md',
          viewMode: 'diff',
        }),
      ]),
    );
  });
});

describe('ChatThreadManager workspace navigation', () => {
  it('navigates backward and forward through workspace selections', () => {
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });
    manager.openFilePreview({
      path: 'README.md',
      label: 'README.md',
      viewMode: 'preview',
    });
    manager.openSessionCronPanel('parent-session-1');

    expect(useChatThreadStore.getState().snapshot.workspaceNavigationHistory).toEqual([
      { kind: 'child-session', key: 'child-session-1' },
      { kind: 'file', key: 'parent-session-1::preview::README.md' },
      { kind: 'cron' },
    ]);

    manager.goBackWorkspacePanel();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey: 'parent-session-1::preview::README.md',
      workspaceNavigationHistoryIndex: 1,
    });

    manager.goBackWorkspacePanel();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'child-session-1',
      workspaceNavigationHistoryIndex: 0,
    });

    manager.goForwardWorkspacePanel();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey: 'parent-session-1::preview::README.md',
      workspaceNavigationHistoryIndex: 1,
    });
  });

  it('truncates workspace forward history after selecting a new entry', () => {
    useChatThreadStore.getState().setSnapshot({
      childSessionTabs: [
        ...useChatThreadStore.getState().snapshot.childSessionTabs,
        {
          sessionKey: 'child-session-2',
          parentSessionKey: 'parent-session-1',
          label: 'Child Session 2',
          agentId: 'writer',
        },
      ],
    });
    const manager = new ChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof ChatThreadManager>[0],
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });
    manager.openFilePreview({
      path: 'README.md',
      label: 'README.md',
      viewMode: 'preview',
    });
    manager.goBackWorkspacePanel();
    manager.selectChildSessionDetail('child-session-2');

    expect(useChatThreadStore.getState().snapshot.workspaceNavigationHistory).toEqual([
      { kind: 'child-session', key: 'child-session-1' },
      { kind: 'child-session', key: 'child-session-2' },
    ]);
    expect(useChatThreadStore.getState().snapshot.workspaceNavigationHistoryIndex).toBe(1);
  });

  it('removes a closed active file from workspace history and restores the previous entry', () => {
    const manager = new ChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof ChatThreadManager>[0],
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openChildSessionPanel({
      parentSessionKey: 'parent-session-1',
      activeChildSessionKey: 'child-session-1',
    });
    manager.openFilePreview({
      path: 'README.md',
      label: 'README.md',
      viewMode: 'preview',
    });
    manager.closeWorkspaceFile('parent-session-1::preview::README.md');

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'child-session-1',
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
      ],
      workspaceNavigationHistoryIndex: 0,
    });
  });
});

describe('ChatThreadManager tool actions', () => {
  it('opens child-session tool actions in the workspace panel before child tabs hydrate', async () => {
    useChatThreadStore.getState().setSnapshot({
      childSessionTabs: [],
      activeChildSessionKey: null,
      workspacePanelParentKey: null,
    });
    const uiManager = createUiManager({
      goToSession: vi.fn(),
    });
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleToolAction({
      kind: 'open-session',
      sessionId: ' child-session-9 ',
      sessionKind: 'child',
      agentId: 'verifier-agent',
      label: 'Verifier',
      parentSessionId: ' parent-session-1 ',
    });

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'child-session-9',
      activeWorkspaceFileKey: null,
      childSessionTabs: [
        {
          sessionKey: 'child-session-9',
          parentSessionKey: 'parent-session-1',
          label: 'Verifier',
          agentId: 'verifier-agent',
        },
      ],
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-9' },
      ],
    });
    expect(uiManager.goToSession).not.toHaveBeenCalled();
  });
});

describe('ChatThreadManager showContent', () => {
  it('routes tool actions through the thread manager owner', async () => {
    const uiManager = createUiManager({
      goToSession: vi.fn(),
    });
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleToolAction({
      kind: 'show-content',
      label: 'Show content',
      request: {
        target: {
          type: 'url',
          payload: {
            url: 'https://example.com/read',
          },
        },
        title: 'Example URL',
      },
    });
    await manager.handleToolAction({
      kind: 'open-session',
      sessionId: 'child-session-1',
      sessionKind: 'session',
    });

    expect(uiManager.showContent).toHaveBeenCalledWith({
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
    });
    expect(uiManager.goToSession).toHaveBeenCalledWith('child-session-1');
  });

  it('shows file content through the existing workspace file preview', async () => {
    const manager = new ChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof ChatThreadManager>[0],
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleToolAction({
      kind: 'show-content',
      label: 'Show content',
      request: {
        target: {
          type: 'file',
          payload: {
            path: 'docs/example.md',
            line: 5,
            viewer: 'rendered',
          },
        },
        title: 'Example',
        purpose: 'read',
      },
    });

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey: 'parent-session-1::preview::docs/example.md',
      workspaceFileTabs: [
        expect.objectContaining({
          path: 'docs/example.md',
          label: 'Example',
          line: 5,
          previewViewer: 'rendered',
          viewMode: 'preview',
        }),
      ],
    });
  });

  it('shows URL and panel app content through DocBrowser', async () => {
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleToolAction({
      kind: 'show-content',
      label: 'Show content',
      request: {
        target: {
          type: 'url',
          payload: {
            url: 'https://example.com/read',
          },
        },
        title: 'Example URL',
      },
    });
    await manager.handleToolAction({
      kind: 'show-content',
      label: 'Show content',
      request: {
        target: {
          type: 'panel_app',
          payload: {
            appId: 'reader',
          },
        },
        title: 'Reader',
      },
    });

    expect(uiManager.showContent).toHaveBeenCalledWith({
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
    });
    expect(uiManager.showContent).toHaveBeenCalledWith({
      target: {
        type: 'panel_app',
        payload: {
          appId: 'reader',
        },
      },
      title: 'Reader',
    });
  });

  it('handles ui.show-content events once through the same owner path', async () => {
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleUiShowContentEvent({
      id: 'tool:call-show-content-1:show-content',
      toolCallId: 'call-show-content-1',
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
      purpose: 'read',
      placement: undefined,
    });
    await manager.handleUiShowContentEvent({
      id: 'tool:call-show-content-1:show-content',
      toolCallId: 'call-show-content-1',
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
      purpose: 'read',
      placement: undefined,
    });

    expect(uiManager.showContent).toHaveBeenCalledTimes(1);
    expect(uiManager.showContent).toHaveBeenCalledWith({
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
    });
  });

  it('delegates panel app content to the UI manager owner', async () => {
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleToolAction({
      kind: 'show-content',
      label: 'Show content',
      request: {
        target: {
          type: 'panel_app',
          payload: {
            appId: 'encoded-reader',
          },
        },
        title: 'Reader',
      },
    });

    expect(uiManager.showContent).toHaveBeenCalledWith({
      target: {
        type: 'panel_app',
        payload: {
          appId: 'encoded-reader',
        },
      },
      title: 'Reader',
    });
  });

});

describe('ChatThreadManager inline showContent', () => {
  it('does not auto-open inline panel app content outside the message card', async () => {
    const uiManager = createUiManager();
    const manager = new ChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    await manager.handleUiShowContentEvent({
      id: 'tool:call-show-content-inline:show-content',
      toolCallId: 'call-show-content-inline',
      target: {
        type: 'panel_app',
        payload: {
          appId: 'reader',
        },
      },
      title: 'Reader',
      purpose: 'interact',
      placement: 'inline',
    });

    expect(uiManager.showContent).not.toHaveBeenCalled();
  });
});

describe('ChatThreadManager visible workspace selection', () => {
  it('delegates visible child-session read state to the session list owner', () => {
    const sessionListManager = {
      markVisibleWorkspaceChildRead: vi.fn(),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[1];
    const manager = new ChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof ChatThreadManager>[0],
      sessionListManager,
    );
    const tab = {
      sessionKey: 'child-session-1',
      lastMessageAt: '2026-04-10T10:00:00.000Z',
      readAt: null,
      runStatus: 'completed',
    };

    manager.syncVisibleWorkspaceSelection({ kind: 'child-session', tab });
    manager.syncVisibleWorkspaceSelection({ kind: 'file' });
    manager.syncVisibleWorkspaceSelection(null);

    expect(sessionListManager.markVisibleWorkspaceChildRead).toHaveBeenCalledTimes(1);
    expect(sessionListManager.markVisibleWorkspaceChildRead).toHaveBeenCalledWith(tab);
  });
});

describe('ChatThreadManager deletion', () => {
  it('clears the selected thread state after deleting the current session', async () => {
    const removeQueries = vi.spyOn(appQueryClient, 'removeQueries').mockImplementation(async () => undefined);
    const uiManager = {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
      goToProviders: vi.fn(),
      confirm: vi.fn(async () => true),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];
    const sessionListManager = {
      setSelectedSessionKey: vi.fn((value: string | null) => {
        useChatSessionListStore.getState().setSnapshot({
          selectedSessionKey: value,
        });
      }),
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[1];
    const manager = new ChatThreadManager(
      uiManager,
      sessionListManager,
    );

    await manager.deleteSession();

    expect(sessionListManager.setSelectedSessionKey).toHaveBeenCalledWith(null);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      sessionKey: null,
      canDeleteSession: false,
      workspacePanelParentKey: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    });
    expect(deleteSummaryMock).toHaveBeenCalledWith(appQueryClient, 'parent-session-1');
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: ['ncp-session-messages', 'parent-session-1'],
    });
    expect(uiManager.goToChatRoot).toHaveBeenCalledWith({ replace: true });

    removeQueries.mockRestore();
  });
});
