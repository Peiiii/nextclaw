import { describe, expect, it, vi } from 'vitest';
import { resolveChatInputSurfaceState } from '@nextclaw/agent-chat-ui';
import {
  CONTEXT_REFERENCE_TRIGGER_SPEC,
  createContextReferenceInputSurfacePlugin,
} from '@/features/chat/features/input/input-surface-plugins/context-reference-plugin.utils';
import type { PanelAppEntryView } from '@/shared/lib/api';

function createPanelApp(): PanelAppEntryView {
  return {
    id: 'task-board',
    appId: 'task-board',
    fileName: 'task-board.panel.html',
    kind: 'single-file',
    title: 'Task Board',
    description: 'Track tasks',
    contentPath: '/panels/task-board.panel.html',
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    sizeBytes: 100,
    favorite: false,
    clientDeclared: false,
    clientGranted: false,
    openCount: 0,
  };
}

function createPlugin(onNavigate = vi.fn()) {
  return createContextReferenceInputSurfacePlugin({
    itemTexts: {
      context: {
        backLabel: 'Back',
        backDescription: 'Back to references',
        backHintLabel: 'Enter to go back',
        currentDirectoryLabel: 'Current folder',
        directoryDescription: 'Directory context',
        fileDescription: 'File context',
        filesDescription: 'Browse project files',
        filesHintLabel: 'Enter to browse',
        filesLabel: 'Files & Folders',
        filesSubtitle: 'Project Context',
        panelAppSectionLabel: 'Panel Apps',
        parentLabel: 'Up one folder',
        parentDescription: 'Browse parent',
        parentHintLabel: 'Enter to browse parent',
        projectRootLabel: 'Project directory',
        searchFailedLabel: 'Search failed',
        workspaceSectionLabel: 'Files & Folders',
      },
      panelApp: {
        appIdLabel: 'App ID',
        fileLabel: 'File',
        noDescriptionLabel: 'No description',
        subtitle: 'Panel App',
      },
    },
    menuTexts: {
      loadingLabel: 'Loading',
      sectionLabel: 'References',
      emptyLabel: 'Empty',
      hintLabel: 'Type @',
      itemHintLabel: 'Enter to reference',
    },
    onNavigate,
  });
}

function createData(referencePath: string | null = null) {
  return {
    isPanelAppsLoading: false,
    isServerPathSearchLoading: false,
    isSkillsLoading: false,
    panelApps: [createPanelApp()],
    projectRoot: '/tmp/project',
    recentSkillValues: [],
    referencePath,
    serverPathEntries: [
      {
        name: 'server-path.ts',
        path: '/tmp/project/src/server-path.ts',
        relativePath: 'src/server-path.ts',
        parentRelativePath: 'src',
        kind: 'file' as const,
        hidden: false,
      },
      {
        name: 'docs',
        path: '/tmp/project/docs',
        relativePath: 'docs',
        parentRelativePath: '',
        kind: 'directory' as const,
        hidden: false,
      },
    ],
    serverPathSearchError: null,
    skillRecords: [],
  };
}

describe('context reference input surface plugin', () => {
  it('shows Files & Folders and panel apps in the root @ menu', () => {
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin()],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData(),
    });

    expect(state.panel?.items).toEqual([
      expect.objectContaining({
        title: 'Files & Folders',
        icon: 'files',
        selectionBehavior: 'navigate',
      }),
      expect.objectContaining({
        key: 'panel-app:task-board',
        tokenKind: 'panel_app',
        tokenKey: 'task-board',
      }),
    ]);
  });

  it('builds file and directory tokens with path previews in files mode', () => {
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin()],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'server',
        start: 0,
        end: 7,
      },
      data: createData(''),
    });

    expect(state.panel?.items.slice(1)).toEqual([
      expect.objectContaining({
        title: 'server-path.ts',
        tokenKind: 'workspace_file',
        tokenKey: 'src/server-path.ts',
        pathPreview: {
          rootLabel: 'project',
          segments: [
            { label: 'src', kind: 'directory' },
            { label: 'server-path.ts', kind: 'file' },
          ],
        },
      }),
      expect.objectContaining({
        title: 'docs',
        tokenKind: 'workspace_directory',
        tokenKey: 'docs',
      }),
    ]);
  });

  it('navigates without producing a composer token', () => {
    const onNavigate = vi.fn();
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData(),
    });
    const item = state.panel?.items[0];

    state.panel?.onSelectItem?.(item!);

    expect(onNavigate).toHaveBeenCalledWith('');
    expect(item).not.toHaveProperty('tokenKind');
  });

  it('opens browsed directories and offers the current folder as a token', () => {
    const onNavigate = vi.fn();
    const rootState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData(''),
    });
    const directoryItem = rootState.panel?.items.find((item) => item.title === 'docs');

    expect(directoryItem).toMatchObject({
      selectionBehavior: 'navigate',
      value: 'docs',
    });
    expect(directoryItem?.tokenKind).toBeUndefined();
    rootState.panel?.onSelectItem?.(directoryItem!);
    expect(onNavigate).toHaveBeenCalledWith('docs');

    const nestedState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData('docs'),
    });
    expect(nestedState.panel?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'docs',
        subtitle: 'Current folder',
        tokenKind: 'workspace_directory',
        tokenKey: 'docs',
      }),
      expect.objectContaining({
        title: 'Up one folder',
        selectionBehavior: 'navigate',
      }),
    ]));
  });
});
