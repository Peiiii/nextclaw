import { beforeEach, describe, expect, it } from 'vitest';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

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
      workspaceFileTabs: [],
      activeWorkspaceFileKey: null,
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
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
          rawText: '# Hello',
          fullLines: [],
        },
      ],
      activeWorkspaceFileKey: 'session-1::preview::README.md',
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
      workspaceNavigationHistory: [
        { kind: 'child-session', key: 'child-session-1' },
        { kind: 'file', key: 'session-1::preview::README.md' },
      ],
      workspaceNavigationHistoryIndex: 1,
    });
    expect(persisted.state.snapshot.sessionKey).toBeUndefined();
    expect(persisted.state.snapshot.isSending).toBeUndefined();
    expect(persisted.state.snapshot.workspaceFileTabs[0].rawText).toBe('# Hello');
    expect(persisted.state.snapshot.workspaceFileTabs[0].fullLines).toBeUndefined();
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
          rawText: '# Hello',
        },
      ],
    });
  });
});
