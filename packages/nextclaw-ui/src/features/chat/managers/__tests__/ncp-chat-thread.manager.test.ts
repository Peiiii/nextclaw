import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appQueryClient } from '@/app-query-client';
import { NcpChatThreadManager } from '@/features/chat/managers/ncp-chat-thread.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type { PanelAppEntryView } from '@/shared/lib/api';
import type * as SharedApi from '@/shared/lib/api';

const { deleteNcpSessionMock, deleteSummaryMock, listPanelAppsMock } = vi.hoisted(() => ({
  deleteNcpSessionMock: vi.fn(async () => ({ deleted: true, sessionId: 'parent-session-1' })),
  deleteSummaryMock: vi.fn(),
  listPanelAppsMock: vi.fn(),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    deleteNcpSession: deleteNcpSessionMock,
    deleteNcpSessionSummaryInQueryClient: deleteSummaryMock,
    nextclawClient: {
      panelApps: {
        listPanelApps: listPanelAppsMock,
      },
    },
  };
});

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
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    },
  });
  listPanelAppsMock.mockReset();
  listPanelAppsMock.mockResolvedValue({ entries: [] });
});

function createDocBrowserManager(): ConstructorParameters<typeof NcpChatThreadManager>[3] {
  return {
    open: vi.fn(),
    openTarget: vi.fn(),
  } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[3];
}

function createPanelAppEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  return {
    appId: 'reader',
    clientDeclared: false,
    clientGranted: false,
    contentPath: '/api/panel-apps/encoded-reader/content',
    createdAt: '2026-06-09T00:00:00.000Z',
    favorite: false,
    fileName: 'reader.panel',
    id: 'encoded-reader',
    kind: 'folder',
    openCount: 0,
    sizeBytes: 1024,
    title: 'Reader',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('NcpChatThreadManager', () => {
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
      createDocBrowserManager(),
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
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];

    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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

describe('NcpChatThreadManager workspace navigation', () => {
  it('navigates backward and forward through workspace selections', () => {
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
      createDocBrowserManager(),
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
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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

describe('NcpChatThreadManager showContent', () => {
  it('routes tool actions through the thread manager owner', async () => {
    const docBrowserManager = createDocBrowserManager();
    const uiManager = {
      goToSession: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0];
    const manager = new NcpChatThreadManager(
      uiManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      docBrowserManager,
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

    expect(docBrowserManager.open).toHaveBeenCalledWith('https://example.com/read', {
      title: 'Example URL',
    });
    expect(uiManager.goToSession).toHaveBeenCalledWith('child-session-1');
  });

  it('shows file content through the existing workspace file preview', async () => {
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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
          viewMode: 'preview',
        }),
      ],
    });
  });

  it('shows URL and panel app content through DocBrowser', async () => {
    const docBrowserManager = createDocBrowserManager();
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      docBrowserManager,
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
    listPanelAppsMock.mockResolvedValue({
      entries: [createPanelAppEntry()],
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

    expect(docBrowserManager.open).toHaveBeenNthCalledWith(1, 'https://example.com/read', {
      title: 'Example URL',
    });
    expect(docBrowserManager.openTarget).toHaveBeenCalledWith({
      dedupeKey: 'panel-app:encoded-reader',
      historyPolicy: 'managed',
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/encoded-reader',
      title: 'Reader',
      url: '/api/panel-apps/encoded-reader/content',
    }, {
      title: 'Reader',
    });
  });

  it('falls back to a direct panel app resource uri when no listed entry matches', async () => {
    const docBrowserManager = createDocBrowserManager();
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[1],
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      docBrowserManager,
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

    expect(docBrowserManager.open).toHaveBeenCalledWith('nextclaw://panel-app/encoded-reader', {
      title: 'Reader',
    });
  });
});

describe('NcpChatThreadManager visible workspace selection', () => {
  it('delegates visible child-session read state to the session list owner', () => {
    const sessionListManager = {
      markVisibleWorkspaceChildRead: vi.fn(),
    } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[1];
    const manager = new NcpChatThreadManager(
      { goToSession: vi.fn() } as unknown as ConstructorParameters<typeof NcpChatThreadManager>[0],
      sessionListManager,
      {} as ConstructorParameters<typeof NcpChatThreadManager>[2],
      createDocBrowserManager(),
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

describe('NcpChatThreadManager deletion', () => {
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
      createDocBrowserManager(),
    );

    await (manager as unknown as { deleteCurrentSession: () => Promise<void> }).deleteCurrentSession();

    expect(sessionListManager.setSelectedSessionKey).toHaveBeenCalledWith(null);
    expect(useChatSessionListStore.getState().snapshot.selectedSessionKey).toBeNull();
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      sessionKey: null,
      canDeleteSession: false,
      messages: [],
      workspacePanelParentKey: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
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
