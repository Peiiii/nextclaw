import { beforeEach, describe, expect, it } from 'vitest';
import {
  useChatThreadStore,
} from '@/features/chat/stores/chat-thread.store';
import { CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH } from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';

const chatThreadWorkspaceStorageKey = 'nextclaw.chat.workspace-panel.state';

function createLocalStoragePersistStorage() {
  return {
    getItem: (name: string) => JSON.parse(window.localStorage.getItem(name) ?? 'null'),
    setItem: (name: string, value: unknown) => window.localStorage.setItem(name, JSON.stringify(value)),
    removeItem: (name: string) => window.localStorage.removeItem(name)
  };
}

function resetChatThreadStore() {
  useChatThreadStore.setState({
    snapshot: {
      ...useChatThreadStore.getState().snapshot,
      sessionKey: null,
      messages: [],
      isSending: false,
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      childSessionTabs: [],
      activeChildSessionKey: null,
      activeSideChatDraft: null,
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      closedWorkspaceTabEntries: [],
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
      workspacePanelWidth: CHAT_WORKSPACE_PANEL_DEFAULT_WIDTH,
    },
  });
}

describe('chat thread workspace panel persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useChatThreadStore.persist.setOptions({
      storage: createLocalStoragePersistStorage(),
    });
    resetChatThreadStore();
    window.localStorage.clear();
  });

  it('persists only the workspace panel continuity state', () => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-1',
      isSending: true,
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'file',
      workspaceFileTabs: [
        {
          key: 'session-1::preview::README.md',
          parentSessionKey: 'session-1',
          path: 'README.md',
          label: 'README.md',
          viewMode: 'preview',
          previewViewer: 'rendered',
          rawText: '# Hello',
          fullLines: [],
        },
      ],
      activeWorkspaceFileKey: 'session-1::preview::README.md',
      closedWorkspaceTabEntries: [
        { kind: 'project-files' },
        { kind: 'child-session', key: 'child-session-2' },
      ],
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
        { kind: 'file', key: 'session-1::preview::README.md' },
      ],
      workspaceNavigationHistoryIndex: 1,
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(chatThreadWorkspaceStorageKey) ?? '{}',
    );

    expect(persisted.state.snapshot).toMatchObject({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey: 'session-1::preview::README.md',
      closedWorkspaceTabEntries: [
        { kind: 'project-files' },
        { kind: 'child-session', key: 'child-session-2' },
      ],
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
        { kind: 'file', key: 'session-1::preview::README.md' },
      ],
      workspaceNavigationHistoryIndex: 1,
    });
    expect(persisted.state.snapshot.sessionKey).toBeUndefined();
    expect(persisted.state.snapshot.isSending).toBeUndefined();
    expect(persisted.state.snapshot.workspaceFileTabs[0].rawText).toBe('# Hello');
    expect(persisted.state.snapshot.workspaceFileTabs[0].previewViewer).toBe('rendered');
    expect(persisted.state.snapshot.workspaceFileTabs[0].fullLines).toBeUndefined();
  });

  it('does not persist an unmaterialized side chat draft', () => {
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'side-chat-draft',
      activeSideChatDraft: {
        draftKey: 'draft-1',
        parentSessionKey: 'session-1',
      },
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
        { kind: 'side-chat-draft', key: 'draft-1' },
      ],
      workspaceNavigationHistoryIndex: 1,
    });

    const persisted = JSON.parse(
      window.localStorage.getItem(chatThreadWorkspaceStorageKey) ?? '{}',
    );

    expect(persisted.state.snapshot).toMatchObject({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: null,
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
      ],
      workspaceNavigationHistoryIndex: 0,
    });
    expect(persisted.state.snapshot.activeSideChatDraft).toBeUndefined();
  });

  it('persists the stable workspace pages', async () => {
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'project-files',
      workspaceNavigationHistory: [
        { kind: 'overview' },
        { kind: 'child-sessions' },
        { kind: 'project-files' },
      ],
      workspaceNavigationHistoryIndex: 2,
      workspacePanelWidth: 620,
    });

    const persisted = window.localStorage.getItem(chatThreadWorkspaceStorageKey);
    resetChatThreadStore();
    if (persisted) {
      window.localStorage.setItem(chatThreadWorkspaceStorageKey, persisted);
    }
    await useChatThreadStore.persist.rehydrate();

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'project-files',
      workspaceNavigationHistory: [
        { kind: 'overview' },
        { kind: 'child-sessions' },
        { kind: 'project-files' },
      ],
      workspaceNavigationHistoryIndex: 2,
      workspacePanelWidth: 620,
    });
  });

  it('keeps the active file tab when persistence trims older workspace tabs', async () => {
    const workspaceFileTabs = Array.from({ length: 9 }, (_, index) => ({
      key: `session-1::preview::file-${index}.txt`,
      parentSessionKey: 'session-1',
      path: `file-${index}.txt`,
      viewMode: 'preview' as const,
      previewViewer: 'source' as const,
    }));
    const activeWorkspaceFileKey = workspaceFileTabs[8]!.key;
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'file',
      workspaceFileTabs,
      activeWorkspaceFileKey,
      workspaceNavigationHistory: [
        { kind: 'file', key: activeWorkspaceFileKey },
      ],
      workspaceNavigationHistoryIndex: 0,
    });

    const persisted = window.localStorage.getItem(chatThreadWorkspaceStorageKey);
    resetChatThreadStore();
    if (persisted) {
      window.localStorage.setItem(chatThreadWorkspaceStorageKey, persisted);
    }
    await useChatThreadStore.persist.rehydrate();

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey,
    });
    expect(useChatThreadStore.getState().snapshot.workspaceFileTabs).toHaveLength(8);
    expect(
      useChatThreadStore.getState().snapshot.workspaceFileTabs.some(
        (tab) => tab.key === activeWorkspaceFileKey,
      ),
    ).toBe(true);
  });

  it('hydrates the workspace panel state and repairs stale active file keys', async () => {
    window.localStorage.setItem(
      chatThreadWorkspaceStorageKey,
      JSON.stringify({
        state: {
          snapshot: {
            workspacePanelParentKey: 'session-1',
            activeWorkspacePanelKind: 'file',
            activeWorkspaceFileKey: 'missing-file',
            activeChildSessionKey: 'child-session-1',
            workspaceNavigationHistory: [
              { kind: 'file', key: 'missing-file' },
              { kind: 'file', key: 'session-1::preview::README.md' },
            ],
            workspaceNavigationHistoryIndex: 1,
            workspaceFileTabs: [
              {
                key: 'session-1::preview::README.md',
                parentSessionKey: 'session-1',
                path: 'README.md',
                label: 'README.md',
                viewMode: 'preview',
                previewViewer: 'rendered',
                rawText: '# Hello',
              },
              {
                key: 'invalid',
                parentSessionKey: 'session-1',
                path: '',
                viewMode: 'preview',
              },
            ],
          },
        },
        version: 2,
      }),
    );

    await useChatThreadStore.persist.rehydrate();

    expect(useChatThreadStore.getState().snapshot).toMatchObject({
      workspacePanelParentKey: 'session-1',
      activeWorkspacePanelKind: 'file',
      activeWorkspaceFileKey: 'session-1::preview::README.md',
      activeChildSessionKey: 'child-session-1',
      workspaceNavigationHistory: [
        { kind: 'file', key: 'session-1::preview::README.md' },
      ],
      workspaceNavigationHistoryIndex: 0,
      workspaceFileTabs: [
        {
          key: 'session-1::preview::README.md',
          parentSessionKey: 'session-1',
          path: 'README.md',
          label: 'README.md',
          viewMode: 'preview',
          previewViewer: 'rendered',
          rawText: '# Hello',
        },
      ],
    });
  });
});
