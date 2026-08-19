import { describe, expect, it, vi } from 'vitest';
import { resolveChatInputSurfaceState } from '@nextclaw/agent-chat-ui';
import {
  CONTEXT_REFERENCE_TRIGGER_SPEC,
  createContextReferenceInputSurfacePlugin,
} from '@/features/chat/features/input/input-surface-plugins/context-reference-plugin.utils';
import type {
  ChatInputProductPluginData,
  ContextReferenceLocation,
} from '@/features/chat/features/input/input-surface-plugins/chat-input-product-plugin-adapters.types';
import type { PanelAppEntryView, ProjectView, SystemObjectReferenceGroupView } from '@/shared/lib/api';

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
    mainSidebar: false,
    clientDeclared: false,
    clientGranted: false,
    openCount: 0,
  };
}

function createProject(): ProjectView {
  return {
    name: 'NextClaw',
    rootPath: '/tmp/nextclaw',
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z',
  };
}

function createSystemObjectGroup(
  items: SystemObjectReferenceGroupView['items'] = [],
): SystemObjectReferenceGroupView {
  return {
    objectType: 'cron-job',
    label: {
      default: 'Scheduled Tasks',
      translations: { zh: '定时任务' },
    },
    description: {
      default: 'Reference task schedules and instructions.',
      translations: { zh: '引用任务计划和指令。' },
    },
    icon: 'calendar-clock',
    order: 200,
    items,
    total: items.length,
  };
}

function createPlugin(
  onNavigate = vi.fn(),
  onSelectSystemObject = vi.fn(),
) {
  return createContextReferenceInputSurfacePlugin({
    itemTexts: {
      context: {
        backLabel: 'Back',
        backDescription: 'Back to references',
        backHintLabel: 'Enter to go back',
        currentDirectoryLabel: 'Reference current folder',
        directoryDescription: 'Directory context',
        fileDescription: 'File context',
        filesDescription: 'Browse project files',
        filesHintLabel: 'Enter to browse',
        filesLabel: 'Files',
        filesSubtitle: 'Project Context',
        foldersDescription: 'Browse project folders',
        foldersHintLabel: 'Enter to browse folders',
        foldersLabel: 'Folders',
        foldersSubtitle: 'Project Context',
        panelAppSectionLabel: 'Panel Apps',
        parentLabel: 'Up one folder',
        parentDescription: 'Browse parent',
        parentHintLabel: 'Enter to browse parent',
        projectDescription: 'Project context',
        projectPathLabel: 'Project path',
        projectSectionLabel: 'Projects',
        projectSubtitle: 'Project',
        projectsDescription: 'Browse registered projects',
        projectsHintLabel: 'Enter to browse projects',
        projectsLabel: 'Projects',
        projectsLoadFailedLabel: 'Projects failed',
        projectsSubtitle: 'Project Context',
        projectRootLabel: 'Project directory',
        searchFailedLabel: 'Search failed',
        systemObjectGroupHintLabel: 'Browse category',
        systemObjectSectionLabel: 'System Objects',
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
    language: 'en',
    onNavigate,
    onSelectSystemObject,
  });
}

function createData(
  referenceLocation: ContextReferenceLocation = { view: 'root' },
): ChatInputProductPluginData {
  return {
    isPanelAppsLoading: false,
    isProjectsLoading: false,
    isServerPathSearchLoading: false,
    isSkillsLoading: false,
    panelApps: [createPanelApp()],
    projectRoot: '/tmp/project',
    projects: [createProject()],
    projectsError: null,
    recentSkillValues: [],
    referenceLocation,
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
    systemObjectGroups: [createSystemObjectGroup()],
    systemObjectsError: null,
    isSystemObjectsLoading: false,
  };
}

describe('context reference input surface plugin', () => {
  it('shows separate file, folder, project, and system-object entries in the root @ menu', () => {
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
        title: 'Files',
        icon: 'files',
        selectionBehavior: 'navigate',
      }),
      expect.objectContaining({
        title: 'Folders',
        icon: 'folder',
        selectionBehavior: 'navigate',
      }),
      expect.objectContaining({
        title: 'Projects',
        icon: 'project',
        selectionBehavior: 'navigate',
      }),
      expect.objectContaining({
        title: 'Scheduled Tasks',
        icon: 'calendar-clock',
        selectionBehavior: 'navigate',
        value: 'cron-job',
      }),
      expect.objectContaining({
        key: 'panel-app:task-board',
        tokenKind: 'panel_app',
        tokenKey: 'task-board',
      }),
    ]);
  });

  it('navigates into a provider group and browses only that group', () => {
    const onNavigate = vi.fn();
    const rootData = createData();
    const rootState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: rootData,
    });
    const groupItem = rootState.panel?.items.find(({ value }) => value === 'cron-job');

    rootState.panel?.onSelectItem?.(groupItem!);
    expect(onNavigate).toHaveBeenCalledWith({ view: 'system-objects', objectType: 'cron-job' });

    const groupData = createData({ view: 'system-objects', objectType: 'cron-job' });
    groupData.systemObjectGroups = [createSystemObjectGroup([{
      uri: 'nextclaw://objects/cron-job/daily-review',
      objectType: 'cron-job',
      objectId: 'daily-review',
      label: 'Daily review',
      description: 'Review project risks',
      updatedAt: '2026-08-11T00:00:00.000Z',
    }])];
    const groupState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: groupData,
    });

    expect(groupState.panel?.items).toEqual([
      expect.objectContaining({ title: 'Back', selectionBehavior: 'navigate' }),
      expect.objectContaining({
        title: 'Daily review',
        sectionKey: 'system-objects:cron-job',
        sectionLabel: 'Scheduled Tasks',
      }),
    ]);
  });

  it('returns only file tokens when searching in files mode', () => {
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin()],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'server',
        start: 0,
        end: 7,
      },
      data: createData({ view: 'files', path: '' }),
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

    expect(onNavigate).toHaveBeenCalledWith({ view: 'files', path: '' });
    expect(item).not.toHaveProperty('tokenKind');
  });

  it('resolves system objects through an explicit selection action', () => {
    const onSelectSystemObject = vi.fn();
    const data = createData();
    data.systemObjectGroups = [createSystemObjectGroup([{
      uri: 'nextclaw://objects/cron-job/daily-review',
      objectType: 'cron-job',
      objectId: 'daily-review',
      label: 'Daily review',
      description: 'Summarize project risks every day',
      updatedAt: '2026-08-11T00:00:00.000Z',
    }])];
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin(vi.fn(), onSelectSystemObject)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'daily',
        start: 0,
        end: 6,
      },
      data,
    });
    const item = state.panel?.items.find(({ title }) => title === 'Daily review');

    expect(item).toMatchObject({
      icon: 'calendar-clock',
      selectionBehavior: 'action',
      subtitle: 'Scheduled Tasks',
    });
    state.panel?.onSelectItem?.(item!);

    expect(onSelectSystemObject).toHaveBeenCalledWith(
      'nextclaw://objects/cron-job/daily-review',
    );
    expect(item).not.toHaveProperty('tokenKind');
  });
});

describe('context reference item behavior', () => {
  it('separates file and folder search results at root and inside each entry', () => {
    const plugin = createPlugin();
    const rootState = resolveChatInputSurfaceState({
      plugins: [plugin],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'project',
        start: 0,
        end: 8,
      },
      data: createData(),
    });
    const rootWorkspaceItems = rootState.panel?.items.filter(
      ({ key }) => key.startsWith('workspace:'),
    );
    expect(rootWorkspaceItems).toEqual([
      expect.objectContaining({
        title: 'server-path.ts',
        sectionKey: 'workspace-files',
        sectionLabel: 'Files',
        tokenKind: 'workspace_file',
      }),
      expect.objectContaining({
        title: 'docs',
        sectionKey: 'workspace-folders',
        sectionLabel: 'Folders',
        tokenKind: 'workspace_directory',
      }),
    ]);

    const filesState = resolveChatInputSurfaceState({
      plugins: [plugin],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'project',
        start: 0,
        end: 8,
      },
      data: createData({ view: 'files', path: '' }),
    });
    expect(filesState.panel?.items.slice(1)).toEqual([
      expect.objectContaining({ title: 'server-path.ts', tokenKind: 'workspace_file' }),
    ]);

    const foldersState = resolveChatInputSurfaceState({
      plugins: [plugin],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'project',
        start: 0,
        end: 8,
      },
      data: createData({ view: 'folders', path: '' }),
    });
    expect(foldersState.panel?.items.slice(1)).toEqual([
      expect.objectContaining({ title: 'docs', tokenKind: 'workspace_directory' }),
    ]);
  });

  it('keeps provider sections separate during global system object search', () => {
    const data = createData();
    const cronGroup = createSystemObjectGroup([{
      uri: 'nextclaw://objects/cron-job/daily-review',
      objectType: 'cron-job',
      objectId: 'daily-review',
      label: 'Daily review',
      description: 'Daily task',
      updatedAt: '2026-08-11T00:00:00.000Z',
    }]);
    data.systemObjectGroups = [{
      ...createSystemObjectGroup([{
        uri: 'nextclaw://objects/inbox-delivery/report-1',
        objectType: 'inbox-delivery',
        objectId: 'report-1',
        label: 'Daily report',
        description: 'Daily inbox report',
        updatedAt: '2026-08-11T01:00:00.000Z',
      }]),
      objectType: 'inbox-delivery',
      label: { default: 'Inbox Reports' },
      icon: 'inbox',
      order: 100,
    }, cronGroup];
    const state = resolveChatInputSurfaceState({
      plugins: [createPlugin()],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'daily',
        start: 0,
        end: 6,
      },
      data,
    });

    expect(state.panel?.items.filter(({ key }) => key.startsWith('context-reference:system-object:')))
      .toEqual([
        expect.objectContaining({
          title: 'Daily report',
          sectionKey: 'system-objects:inbox-delivery',
          sectionLabel: 'Inbox Reports',
        }),
        expect.objectContaining({
          title: 'Daily review',
          sectionKey: 'system-objects:cron-job',
          sectionLabel: 'Scheduled Tasks',
        }),
      ]);
  });

  it('opens browsed folders and offers the current folder as a token', () => {
    const onNavigate = vi.fn();
    const rootState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData({ view: 'folders', path: '' }),
    });
    const directoryItem = rootState.panel?.items.find((item) => item.title === 'docs');

    expect(rootState.panel?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Reference current folder',
        subtitle: 'project',
        tokenKind: 'workspace_directory',
        tokenKey: '.',
      }),
    ]));
    expect(directoryItem).toMatchObject({
      selectionBehavior: 'navigate',
      value: 'docs',
    });
    expect(directoryItem?.tokenKind).toBeUndefined();
    rootState.panel?.onSelectItem?.(directoryItem!);
    expect(onNavigate).toHaveBeenCalledWith({ view: 'folders', path: 'docs' });

    const nestedState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData({ view: 'folders', path: 'docs' }),
    });
    expect(nestedState.panel?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Reference current folder',
        subtitle: 'docs',
        tokenKind: 'workspace_directory',
        tokenKey: 'docs',
      }),
      expect.objectContaining({
        title: 'Up one folder',
        selectionBehavior: 'navigate',
      }),
    ]));
  });

  it('opens the project view and builds semantic project tokens', () => {
    const onNavigate = vi.fn();
    const rootState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: '',
        start: 0,
        end: 1,
      },
      data: createData(),
    });
    const projectsItem = rootState.panel?.items.find((item) => item.title === 'Projects');

    rootState.panel?.onSelectItem?.(projectsItem!);
    expect(onNavigate).toHaveBeenCalledWith({ view: 'projects' });

    const projectsState = resolveChatInputSurfaceState({
      plugins: [createPlugin(onNavigate)],
      trigger: {
        ...CONTEXT_REFERENCE_TRIGGER_SPEC,
        query: 'next',
        start: 0,
        end: 5,
      },
      data: createData({ view: 'projects' }),
    });

    expect(projectsState.panel?.items).toEqual([
      expect.objectContaining({
        title: 'Back',
        selectionBehavior: 'navigate',
      }),
      expect.objectContaining({
        title: 'NextClaw',
        icon: 'project',
        tokenKind: 'project',
        tokenKey: '/tmp/nextclaw',
        detailLines: ['Project path: /tmp/nextclaw'],
      }),
    ]);
  });
});
