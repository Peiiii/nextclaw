import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

function createUiManager(overrides: Record<string, unknown> = {}): ConstructorParameters<typeof ChatThreadManager>[0] {
  return {
    goToSession: vi.fn(),
    isAtChatRoot: vi.fn(() => true),
    ...overrides,
  } as unknown as ConstructorParameters<typeof ChatThreadManager>[0];
}

describe('ChatThreadManager workspace pages', () => {
  beforeEach(() => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'parent-session-1',
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        workspacePanelParentKey: null,
        activeWorkspacePanelKind: null,
        activeChildSessionKey: null,
        activeWorkspaceFileKey: null,
        draftProjectRoot: null,
        workspaceFileTabs: [],
        closedWorkspaceTabEntries: [],
        workspaceNavigationHistory: [],
        workspaceNavigationHistoryIndex: 0,
      },
    });
  });

  it('opens the stable pages as navigable session pages', () => {
    const onWorkspacePanelOpened = vi.fn();
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
      onWorkspacePanelOpened,
    );

    manager.openWorkspaceOverview('parent-session-1');
    manager.openChildSessions('parent-session-1');
    manager.openProjectFiles('parent-session-1');

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'project-files',
      workspaceNavigationHistory: [
        { kind: 'overview' },
        { kind: 'child-sessions' },
        { kind: 'project-files' },
      ],
      workspaceNavigationHistoryIndex: 2,
    });
    expect(onWorkspacePanelOpened).toHaveBeenCalledTimes(3);
  });

  it('toggles the current session workspace from the stable header action', () => {
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.toggleWorkspacePanel('parent-session-1');
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'parent-session-1',
      activeWorkspacePanelKind: 'overview',
    });

    manager.toggleWorkspacePanel('parent-session-1');
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
    });
  });

  it('opens project files for a draft without exposing session-only pages', () => {
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.toggleWorkspacePanel(null);

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: 'project-files',
      workspaceNavigationHistory: [{ kind: 'project-files' }],
    });
  });

  it('materializes the draft selection, workspace, and route as one owner action', () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        draftProjectRoot: '/tmp/project-alpha',
        workspacePanelParentKey: null,
        activeWorkspacePanelKind: 'file',
        activeWorkspaceFileKey: 'draft::preview::README.md',
        workspaceFileTabs: [
          {
            key: 'draft::preview::README.md',
            parentSessionKey: null,
            path: 'README.md',
            viewMode: 'preview',
          },
        ],
        workspaceNavigationHistory: [
          { kind: 'project-files' },
          { kind: 'file', key: 'draft::preview::README.md' },
        ],
        workspaceNavigationHistoryIndex: 1,
      },
    });
    const uiManager = createUiManager();
    const syncRouteSessionSelection = vi.fn((sessionKey: string) => {
      useChatSessionListStore.getState().setSnapshot({ selectedSessionKey: sessionKey });
      useChatThreadStore.getState().setSnapshot({ draftProjectRoot: null });
    });
    const manager = new ChatThreadManager(uiManager, {
      syncRouteSessionSelection,
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[1]);

    manager.materializeRootDraftSession('materialized-session');

    expect(syncRouteSessionSelection).toHaveBeenCalledWith('materialized-session');
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      draftProjectRoot: null,
      workspacePanelParentKey: 'materialized-session',
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey:
        'materialized-session::preview::README.md',
      workspaceFileTabs: [
        expect.objectContaining({
          key: 'materialized-session::preview::README.md',
          parentSessionKey: 'materialized-session',
        }),
      ],
      workspaceNavigationHistory: [
        { kind: 'project-files' },
        {
          kind: 'file',
          key: 'materialized-session::preview::README.md',
        },
      ],
    });
    expect(uiManager.goToSession).toHaveBeenCalledWith('materialized-session', {
      replace: true,
    });
  });

  it('ignores draft materialization after leaving the root route', () => {
    const uiManager = createUiManager({ isAtChatRoot: vi.fn(() => false) });
    const syncRouteSessionSelection = vi.fn();
    const manager = new ChatThreadManager(uiManager, {
      syncRouteSessionSelection,
    } as unknown as ConstructorParameters<typeof ChatThreadManager>[1]);

    manager.materializeRootDraftSession('materialized-session');

    expect(syncRouteSessionSelection).not.toHaveBeenCalled();
    expect(uiManager.goToSession).not.toHaveBeenCalled();
  });

  it('does not close fixed workspace pages', () => {
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openWorkspaceOverview('parent-session-1');
    manager.openProjectFiles('parent-session-1');
    for (const kind of ['child-sessions', 'cron', 'project-files'] as const) {
      manager.closeWorkspaceTab({ kind });
    }

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'project-files',
      closedWorkspaceTabEntries: [],
      workspaceNavigationHistory: [
        { kind: 'overview' },
        { kind: 'project-files' },
      ],
      workspaceNavigationHistoryIndex: 1,
    });
  });
});
