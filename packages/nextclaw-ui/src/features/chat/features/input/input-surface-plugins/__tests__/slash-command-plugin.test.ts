import { describe, expect, it, vi } from 'vitest';
import { resolveChatInputSurfaceState } from '@nextclaw/agent-chat-ui';
import { createSlashCommandInputSurfacePlugin } from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';
import type { PanelAppEntryView } from '@/shared/lib/api';

function createPanelApp(
  overrides: Partial<PanelAppEntryView> & Pick<PanelAppEntryView, 'appId' | 'title'>,
): PanelAppEntryView {
  return {
    id: overrides.id ?? overrides.appId,
    appId: overrides.appId,
    fileName: overrides.fileName ?? `${overrides.appId}.panel.html`,
    kind: overrides.kind ?? 'single-file',
    title: overrides.title,
    description: overrides.description,
    contentPath: overrides.contentPath ?? `/panels/${overrides.appId}.panel.html`,
    createdAt: overrides.createdAt ?? '2026-06-18T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-18T00:00:00.000Z',
    sizeBytes: overrides.sizeBytes ?? 100,
    favorite: overrides.favorite ?? false,
    clientDeclared: overrides.clientDeclared ?? false,
    clientGranted: overrides.clientGranted ?? false,
    lastOpenedAt: overrides.lastOpenedAt,
    openCount: overrides.openCount ?? 0,
  };
}

function createPlugin(
  params: {
    onSelectCommand?: () => void;
    onSelectPanelApp?: (appId: string) => void;
  } = {},
) {
  return createSlashCommandInputSurfacePlugin({
    commands: [
      {
        key: 'side-chat',
        title: 'Side chat',
        description: 'Open side chat',
        detailLines: ['Creates a child session on first send'],
        keywords: ['side', 'chat'],
        onSelect: params.onSelectCommand ?? vi.fn(),
      },
    ],
    itemTexts: {
      panelAppTexts: {
        appIdLabel: 'App ID',
        fileLabel: 'File',
        noDescriptionLabel: 'No panel app description',
        subtitle: 'Panel App',
      },
      skillTexts: {
        noSkillDescription: 'No description',
        slashSkillScopeLabel: 'Scope',
        slashSkillSpecLabel: 'Spec',
        slashSkillSubtitle: 'Skill',
      },
    },
    labels: {
      commandHintLabel: 'Run command',
      commandSectionLabel: 'Commands',
      commandSubtitle: 'Command',
      filterAllLabel: 'All',
      filterCommandsLabel: 'Commands',
      filterPanelAppsLabel: 'Panel Apps',
      filterSkillsLabel: 'Skills',
      panelAppHintLabel: 'Open panel app',
      panelAppSectionLabel: 'Panel Apps',
      skillHintLabel: 'Add skill',
      skillSectionLabel: 'Skills',
    },
    menuTexts: {
      emptyLabel: 'No result',
      hintLabel: 'Type /',
      itemHintLabel: 'Select item',
      loadingLabel: 'Loading',
      sectionLabel: 'Slash',
    },
    onSelectPanelApp: params.onSelectPanelApp ?? vi.fn(),
    onSelectSkill: vi.fn(),
  });
}

describe('createSlashCommandInputSurfacePlugin', () => {
  it('places command items before skill items in the slash panel', () => {
    const state = resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: false,
        isSkillsLoading: false,
        panelApps: [
          createPanelApp({
            appId: 'task-board',
            title: 'Task Board',
            description: 'Track tasks',
          }),
        ],
        recentSkillValues: [],
        skillRecords: [
          {
            key: 'web-search',
            label: 'Web Search',
            description: 'Search web',
          },
        ],
      },
      plugins: [createPlugin()],
      trigger: {
        key: 'slash',
        marker: '/',
        query: '',
        start: 0,
        end: 1,
      },
    });

    expect(state.panel?.items.map((item) => item.key)).toEqual([
      'command:side-chat',
      'skill:web-search',
      'panel-app-action:task-board',
    ]);
    expect(state.panel?.filterOptions).toEqual([
      { key: 'all', label: 'All' },
      { key: 'commands', label: 'Commands', sectionKeys: ['commands'] },
      { key: 'skills', label: 'Skills', sectionKeys: ['skills'] },
      { key: 'panel-apps', label: 'Panel Apps', sectionKeys: ['panel-apps'] },
    ]);
    expect(state.panel?.items[0]).toMatchObject({
      sectionKey: 'commands',
      sectionLabel: 'Commands',
      hintLabel: 'Run command',
    });
    expect(state.panel?.items[1]).toMatchObject({
      sectionKey: 'skills',
      sectionLabel: 'Skills',
      hintLabel: 'Add skill',
    });
    expect(state.panel?.items[2]).toMatchObject({
      sectionKey: 'panel-apps',
      sectionLabel: 'Panel Apps',
      hintLabel: 'Open panel app',
    });
  });

  it('runs a command item through the panel selection handler', () => {
    const onSelectCommand = vi.fn();
    const state = resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: false,
        isSkillsLoading: false,
        panelApps: [],
        recentSkillValues: [],
        skillRecords: [],
      },
      plugins: [createPlugin({ onSelectCommand })],
      trigger: {
        key: 'slash',
        marker: '/',
        query: 'side',
        start: 0,
        end: 5,
      },
    });

    const item = state.panel?.items[0];
    expect(item?.key).toBe('command:side-chat');
    state.panel?.onSelectItem?.(item!);
    expect(onSelectCommand).toHaveBeenCalledTimes(1);
  });

  it('opens a panel app action without turning it into an input token', () => {
    const onSelectPanelApp = vi.fn();
    const state = resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: false,
        isSkillsLoading: false,
        panelApps: [
          createPanelApp({
            appId: 'task-board',
            title: 'Task Board',
            description: 'Track tasks',
          }),
        ],
        recentSkillValues: [],
        skillRecords: [],
      },
      plugins: [createPlugin({ onSelectPanelApp })],
      trigger: {
        key: 'slash',
        marker: '/',
        query: 'task',
        start: 0,
        end: 5,
      },
    });

    const item = state.panel?.items[0];
    expect(item).toMatchObject({
      key: 'panel-app-action:task-board',
      title: 'Task Board',
      sectionKey: 'panel-apps',
    });
    expect(item).not.toHaveProperty('tokenKind');
    expect(item).not.toHaveProperty('tokenKey');
    expect(item).not.toHaveProperty('value');
    state.panel?.onSelectItem?.(item!);
    expect(onSelectPanelApp).toHaveBeenCalledWith('task-board');
  });
});
