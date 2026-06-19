import { describe, expect, it, vi } from 'vitest';
import { resolveChatInputSurfaceState } from '@nextclaw/agent-chat-ui';
import { createSlashCommandInputSurfacePlugin } from '@/features/chat/features/input/input-surface-plugins/slash-command-plugin.utils';

function createPlugin(onSelectCommand = vi.fn()) {
  return createSlashCommandInputSurfacePlugin({
    commands: [
      {
        key: 'side-chat',
        title: 'Side chat',
        description: 'Open side chat',
        detailLines: ['Creates a child session on first send'],
        keywords: ['side', 'chat'],
        onSelect: onSelectCommand,
      },
    ],
    itemTexts: {
      noSkillDescription: 'No description',
      slashSkillScopeLabel: 'Scope',
      slashSkillSpecLabel: 'Spec',
      slashSkillSubtitle: 'Skill',
    },
    labels: {
      commandHintLabel: 'Run command',
      commandSectionLabel: 'Commands',
      commandSubtitle: 'Command',
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
    onSelectSkill: vi.fn(),
  });
}

describe('createSlashCommandInputSurfacePlugin', () => {
  it('places command items before skill items in the slash panel', () => {
    const state = resolveChatInputSurfaceState({
      data: {
        isPanelAppsLoading: false,
        isSkillsLoading: false,
        panelApps: [],
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
      plugins: [createPlugin(onSelectCommand)],
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
});
