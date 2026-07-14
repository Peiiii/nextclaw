import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatThreadManager } from '@/features/chat/managers/chat-thread.manager';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

function createUiManager(): ConstructorParameters<typeof ChatThreadManager>[0] {
  return {
    goToSession: vi.fn(),
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

  it('closes a workspace page, restores overview, and reopens the page on demand', () => {
    const manager = new ChatThreadManager(
      createUiManager(),
      {} as ConstructorParameters<typeof ChatThreadManager>[1],
    );

    manager.openWorkspaceOverview('parent-session-1');
    manager.openProjectFiles('parent-session-1');
    manager.closeWorkspaceTab({ kind: 'project-files' });

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'overview',
      closedWorkspaceTabEntries: [{ kind: 'project-files' }],
      workspaceNavigationHistory: [{ kind: 'overview' }],
      workspaceNavigationHistoryIndex: 0,
    });

    manager.openProjectFiles('parent-session-1');
    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      activeWorkspacePanelKind: 'project-files',
      closedWorkspaceTabEntries: [],
    });
  });
});
