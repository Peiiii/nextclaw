import {
  buildChatSlashItems,
  buildModelStateHint,
  buildModelToolbarSelect,
  buildSkillPickerModel
} from '@/features/chat/features/input/utils/chat-input-bar.utils';
import type { ChatSkillRecord } from '@/features/chat/features/input/utils/chat-input-bar.utils';

function createSkillRecord(partial: Partial<ChatSkillRecord>): ChatSkillRecord {
  return {
    key: 'demo.skill',
    label: 'Demo Skill',
    ...partial
  };
}

function createModelTexts() {
  return {
    modelSelectPlaceholder: 'Select model',
    modelNoOptionsLabel: 'No models',
    modelSearchPlaceholder: 'Search models',
    modelSearchEmptyLabel: 'No matching models',
    favoriteModelsLabel: 'Favorites',
    favoriteModelLabel: 'Favorite model',
    unfavoriteModelLabel: 'Remove favorite',
    manageModelsLabel: 'Manage models and providers',
    discoveredModelsSummaryLabel: '{count} new models available',
    discoveredModelsViewLabel: 'View',
    discoveredModelsGroupLabel: 'New models',
    discoveredModelAddLabel: 'Add',
    discoveredModelAddedLabel: 'Added',
    discoveredModelsDismissLabel: 'Dismiss this batch',
    discoveredModelsDoneLabel: 'Done',
    discoveredModelsCloseLabel: 'Close new models',
    recentModelsLabel: 'Recent',
    allModelsLabel: 'All models'
  };
}

describe('buildModelStateHint', () => {
  it('keeps the input surface clear while model options are unresolved', () => {
    expect(buildModelStateHint({
      isModelOptionsEmpty: false,
      onGoToProviders: vi.fn(),
      texts: {
        noModelOptionsLabel: 'No models',
        configureProviderLabel: 'Configure provider'
      }
    })).toBeNull();
  });

  it('keeps the actionable warning when model loading resolves empty', () => {
    const onGoToProviders = vi.fn();

    expect(buildModelStateHint({
      isModelOptionsEmpty: true,
      onGoToProviders,
      texts: {
        noModelOptionsLabel: 'No models',
        configureProviderLabel: 'Configure provider'
      }
    })).toEqual({
      tone: 'warning',
      text: 'No models',
      actionLabel: 'Configure provider',
      onAction: onGoToProviders
    });
  });
});
describe('buildChatSlashItems', () => {
  const texts = {
    slashSkillSubtitle: 'Skill',
    slashSkillSpecLabel: 'Spec',
    slashSkillScopeLabel: 'Scope',
    noSkillDescription: 'No description'
  };

  it('sorts exact spec matches ahead of weaker matches', () => {
    const items = buildChatSlashItems(
      [
        createSkillRecord({ key: 'web-search', label: 'Web Search' }),
        createSkillRecord({ key: 'weather', label: 'Web Weather' })
      ],
      'web',
      texts
    );

    expect(items.map((item) => item.value)).toEqual(['web-search', 'weather']);
    expect(items[0]?.detailLines).toContain('Spec: web-search');
  });

  it('returns an empty list when nothing matches', () => {
    const items = buildChatSlashItems([createSkillRecord({ key: 'weather' })], 'terminal', texts);
    expect(items).toEqual([]);
  });

  it('pushes recent skills ahead when the match strength is the same', () => {
    const items = buildChatSlashItems(
      [
        createSkillRecord({ key: 'docs', label: 'Docs' }),
        createSkillRecord({ key: 'web-search', label: 'Web Search' }),
        createSkillRecord({ key: 'weather', label: 'Weather' })
      ],
      '',
      texts,
      ['weather', 'docs']
    );

    expect(items.map((item) => item.value)).toEqual(['weather', 'docs', 'web-search']);
  });

  it('lets recent skills win inside the same slash match tier', () => {
    const items = buildChatSlashItems(
      [
        createSkillRecord({ key: 'web-search', label: 'Web Search' }),
        createSkillRecord({ key: 'weather', label: 'Web Weather' }),
        createSkillRecord({ key: 'docs', label: 'Docs for web' })
      ],
      'web',
      texts,
      ['weather']
    );

    expect(items.map((item) => item.value)).toEqual(['weather', 'web-search', 'docs']);
  });

  it('keeps skill source groups contiguous in their catalog order', () => {
    const items = buildChatSlashItems(
      [
        createSkillRecord({ key: 'project:zeta', label: 'Zeta', groupKey: 'project', groupLabel: 'Project skills' }),
        createSkillRecord({ key: 'global:alpha', label: 'Alpha', groupKey: 'global', groupLabel: 'Global skills' }),
        createSkillRecord({ key: 'project:alpha', label: 'Alpha', groupKey: 'project', groupLabel: 'Project skills' }),
      ],
      '',
      texts,
    );

    expect(items.map((item) => item.value)).toEqual(['project:alpha', 'project:zeta', 'global:alpha']);
    expect(items.map((item) => [item.sectionKey, item.sectionLabel])).toEqual([
      ['project', 'Project skills'],
      ['project', 'Project skills'],
      ['global', 'Global skills'],
    ]);
  });
});

describe('buildSkillPickerModel', () => {
  it('builds a stable semantic model for toolbar skill picker', () => {
    const onSelectedKeysChange = vi.fn();
    const model = buildSkillPickerModel({
      skillRecords: [createSkillRecord({ key: 'web-search', label: 'Web Search', description: 'Search web' })],
      recentSkillValues: [],
      groupedRecentSkillValues: [],
      selectedSkills: ['web-search'],
      isLoading: false,
      onSelectedKeysChange,
      texts: {
        title: 'Skills',
        searchPlaceholder: 'Search skills',
        emptyLabel: 'No skills',
        loadingLabel: 'Loading',
        manageLabel: 'Manage',
        recentSkillsLabel: 'Recent',
        allSkillsLabel: 'All skills'
      }
    });

    expect(model).toMatchObject({
      title: 'Skills',
      selectedKeys: ['web-search'],
      manageHref: '/marketplace/skills'
    });
    expect(model.options[0]).toMatchObject({
      key: 'web-search',
      label: 'Web Search'
    });
  });

  it('groups recent skills ahead of the remaining catalog', () => {
    const model = buildSkillPickerModel({
      skillRecords: [
        createSkillRecord({ key: 'docs', label: 'Docs' }),
        createSkillRecord({ key: 'web-search', label: 'Web Search' }),
        createSkillRecord({ key: 'weather', label: 'Weather' })
      ],
      recentSkillValues: ['weather', 'docs'],
      groupedRecentSkillValues: ['weather', 'docs'],
      selectedSkills: ['weather'],
      isLoading: false,
      onSelectedKeysChange: vi.fn(),
      texts: {
        title: 'Skills',
        searchPlaceholder: 'Search skills',
        emptyLabel: 'No skills',
        loadingLabel: 'Loading',
        manageLabel: 'Manage',
        recentSkillsLabel: 'Recent',
        allSkillsLabel: 'All skills'
      }
    });

    expect(model.options.map((option) => option.key)).toEqual(['weather', 'docs', 'web-search']);
    expect(model.groups).toEqual([
      {
        key: 'recent-skills',
        label: 'Recent',
        options: [
          expect.objectContaining({ key: 'weather', label: 'Weather' }),
          expect.objectContaining({ key: 'docs', label: 'Docs' })
        ]
      },
      {
        key: 'all-skills',
        label: 'All skills',
        options: [expect.objectContaining({ key: 'web-search', label: 'Web Search' })]
      }
    ]);
  });

  it('groups the skill catalog by source when no recent group is visible', () => {
    const model = buildSkillPickerModel({
      skillRecords: [
        createSkillRecord({ key: 'project:review', label: 'Review', groupKey: 'project', groupLabel: 'Project skills' }),
        createSkillRecord({ key: 'workspace:docs', label: 'Docs', groupKey: 'workspace', groupLabel: 'NextClaw skills' }),
        createSkillRecord({ key: 'global:browser', label: 'Browser', groupKey: 'global', groupLabel: 'Global skills' }),
        createSkillRecord({ key: 'builtin:weather', label: 'Weather', groupKey: 'builtin', groupLabel: 'Built-in skills' })
      ],
      recentSkillValues: [],
      groupedRecentSkillValues: [],
      selectedSkills: [],
      isLoading: false,
      onSelectedKeysChange: vi.fn(),
      texts: {
        title: 'Skills',
        searchPlaceholder: 'Search skills',
        emptyLabel: 'No skills',
        loadingLabel: 'Loading',
        manageLabel: 'Manage',
        recentSkillsLabel: 'Recent',
        allSkillsLabel: 'All skills'
      }
    });

    expect(model.groups?.map((group) => [group.key, group.label])).toEqual([
      ['project', 'Project skills'],
      ['workspace', 'NextClaw skills'],
      ['global', 'Global skills'],
      ['builtin', 'Built-in skills']
    ]);
  });

  it('still reorders recent skills even when grouped labels are omitted', () => {
    const model = buildSkillPickerModel({
      skillRecords: [
        createSkillRecord({ key: 'docs', label: 'Docs' }),
        createSkillRecord({ key: 'web-search', label: 'Web Search' }),
        createSkillRecord({ key: 'weather', label: 'Weather' })
      ],
      recentSkillValues: ['weather'],
      groupedRecentSkillValues: [],
      selectedSkills: [],
      isLoading: false,
      onSelectedKeysChange: vi.fn(),
      texts: {
        title: 'Skills',
        searchPlaceholder: 'Search skills',
        emptyLabel: 'No skills',
        loadingLabel: 'Loading',
        manageLabel: 'Manage',
        recentSkillsLabel: 'Recent',
        allSkillsLabel: 'All skills'
      }
    });

    expect(model.options.map((option) => option.key)).toEqual(['weather', 'docs', 'web-search']);
    expect(model.groups).toBeUndefined();
  });
});

describe('buildModelToolbarSelect', () => {
  it('exposes discovered models through an expanded-panel contract without changing the selected label', () => {
    const onDiscoveredModelsDismiss = vi.fn();
    const onDiscoveredModelSelect = vi.fn();
    const onOpen = vi.fn();
    const select = buildModelToolbarSelect({
      modelOptions: [{
        value: 'opencode/big-pickle',
        modelLabel: 'big-pickle',
        providerLabel: 'OpenCode',
      }],
      discoveredModelOptions: [
        {
          value: 'opencode/deepseek-v4-flash-free',
          modelLabel: 'deepseek-v4-flash-free',
          providerLabel: 'OpenCode',
        },
        {
          value: 'openrouter/inclusionai/ling-3.0-tiny:free',
          modelLabel: 'inclusionai/ling-3.0-tiny:free',
          providerLabel: 'OpenRouter',
        },
      ],
      recentModelValues: [],
      selectedModel: 'opencode/big-pickle',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onDiscoveredModelSelect,
      onDiscoveredModelsDismiss,
      onOpen,
      onValueChange: vi.fn(),
      texts: createModelTexts(),
    });

    expect(select.selectedLabel).toBe('OpenCode/big-pickle');
    expect(select.discovery).toEqual({
      summaryLabel: '2 new models available',
      viewLabel: 'View',
      groupLabel: 'New models',
      allGroupLabel: 'All models',
      actionLabel: 'Add',
      addedLabel: 'Added',
      dismissLabel: 'Dismiss this batch',
      doneLabel: 'Done',
      closeLabel: 'Close new models',
      searchPlaceholder: 'Search models',
      searchEmptyLabel: 'No matching models',
      groups: [
        {
          key: 'opencode',
          label: 'OpenCode',
          options: [{
            value: 'opencode/deepseek-v4-flash-free',
            label: 'deepseek-v4-flash-free',
          }],
        },
        {
          key: 'openrouter',
          label: 'OpenRouter',
          options: [{
            value: 'openrouter/inclusionai/ling-3.0-tiny:free',
            label: 'inclusionai/ling-3.0-tiny:free',
          }],
        },
      ],
      onDismiss: onDiscoveredModelsDismiss,
      onSelect: onDiscoveredModelSelect,
    });
    expect(select.onOpen).toBe(onOpen);
  });
});

describe('buildModelToolbarSelect selection', () => {
  it('falls back to the first available option when the selected model is missing', () => {
    const onValueChange = vi.fn();
    const select = buildModelToolbarSelect({
      modelOptions: [
        {
          value: 'minimax/MiniMax-M2.7',
          modelLabel: 'MiniMax-M2.7',
          providerLabel: 'MiniMax'
        }
      ],
      recentModelValues: [],
      selectedModel: 'dashscope/qwen3-coder-next',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onValueChange,
      texts: createModelTexts()
    });

    expect(select.value).toBe('minimax/MiniMax-M2.7');
    expect(select.selectedLabel).toBe('MiniMax/MiniMax-M2.7');
    expect(select.options[0]).toEqual({
      value: 'minimax/MiniMax-M2.7',
      label: 'MiniMax/MiniMax-M2.7'
    });
    expect(select.manageLabel).toBe('Manage models and providers');
    expect(select.manageHref).toBe('/providers');
  });

  it('keeps the full provider/model label in shared state while exposing a compact mobile label', () => {
    const select = buildModelToolbarSelect({
      modelOptions: [
        {
          value: 'anthropic/claude-sonnet-4-very-long-name',
          modelLabel: 'claude-sonnet-4-very-long-name',
          providerLabel: 'Anthropic'
        }
      ],
      recentModelValues: [],
      selectedModel: 'anthropic/claude-sonnet-4-very-long-name',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onValueChange: vi.fn(),
      texts: createModelTexts()
    });

    expect(select.selectedLabel).toBe('Anthropic/claude-sonnet-4-very-long-name');
    expect(select.options[0]?.label).toBe('Anthropic/claude-sonnet-4-very-long-name');
  });

  it('groups recent models ahead of the remaining catalog', () => {
    const select = buildModelToolbarSelect({
      modelOptions: [
        {
          value: 'openai/gpt-5',
          modelLabel: 'gpt-5',
          providerLabel: 'OpenAI'
        },
        {
          value: 'anthropic/claude-sonnet-4',
          modelLabel: 'claude-sonnet-4',
          providerLabel: 'Anthropic'
        },
        {
          value: 'minimax/MiniMax-M2.7',
          modelLabel: 'MiniMax-M2.7',
          providerLabel: 'MiniMax'
        }
      ],
      recentModelValues: ['anthropic/claude-sonnet-4', 'missing/model'],
      selectedModel: 'openai/gpt-5',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onValueChange: vi.fn(),
      texts: createModelTexts()
    });

    expect(select.groups).toEqual([
      {
        key: 'recent-models',
        label: 'Recent',
        options: [
          {
            value: 'anthropic/claude-sonnet-4',
            label: 'Anthropic/claude-sonnet-4'
          }
        ]
      },
      {
        key: 'all-models',
        label: 'All models',
        options: [
          {
            value: 'openai/gpt-5',
            label: 'OpenAI/gpt-5'
          },
          {
            value: 'minimax/MiniMax-M2.7',
            label: 'MiniMax/MiniMax-M2.7'
          }
        ]
      }
    ]);
  });

  it('groups favorite models ahead of recent models without duplicates', () => {
    const onFavoriteToggle = vi.fn();
    const select = buildModelToolbarSelect({
      modelOptions: [
        {
          value: 'openai/gpt-5',
          modelLabel: 'gpt-5',
          providerLabel: 'OpenAI'
        },
        {
          value: 'anthropic/claude-sonnet-4',
          modelLabel: 'claude-sonnet-4',
          providerLabel: 'Anthropic'
        },
        {
          value: 'minimax/MiniMax-M2.7',
          modelLabel: 'MiniMax-M2.7',
          providerLabel: 'MiniMax'
        }
      ],
      favoriteModelValues: ['openai/gpt-5'],
      recentModelValues: ['anthropic/claude-sonnet-4', 'openai/gpt-5'],
      selectedModel: 'openai/gpt-5',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onFavoriteToggle,
      onValueChange: vi.fn(),
      texts: createModelTexts()
    });

    expect(select.groups?.map((group) => group.key)).toEqual([
      'favorite-models',
      'recent-models',
      'all-models'
    ]);
    expect(select.groups?.[0]?.options.map((option) => option.value)).toEqual(['openai/gpt-5']);
    expect(select.groups?.[1]?.options.map((option) => option.value)).toEqual(['anthropic/claude-sonnet-4']);
    expect(select.groups?.[2]?.options.map((option) => option.value)).toEqual(['minimax/MiniMax-M2.7']);
    expect(select.optionAction).toMatchObject({
      kind: 'favorite',
      activeValues: ['openai/gpt-5'],
      activeLabel: 'Remove favorite',
      inactiveLabel: 'Favorite model'
    });
  });

  it('preserves recent model order from newest to oldest', () => {
    const select = buildModelToolbarSelect({
      modelOptions: [
        {
          value: 'openai/gpt-5',
          modelLabel: 'gpt-5',
          providerLabel: 'OpenAI'
        },
        {
          value: 'anthropic/claude-sonnet-4',
          modelLabel: 'claude-sonnet-4',
          providerLabel: 'Anthropic'
        },
        {
          value: 'deepseek/deepseek-chat',
          modelLabel: 'deepseek-chat',
          providerLabel: 'DeepSeek'
        }
      ],
      recentModelValues: ['deepseek/deepseek-chat', 'openai/gpt-5', 'anthropic/claude-sonnet-4'],
      selectedModel: 'openai/gpt-5',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onValueChange: vi.fn(),
      texts: createModelTexts()
    });

    expect(select.groups?.[0]?.options.map((option) => option.value)).toEqual([
      'deepseek/deepseek-chat',
      'openai/gpt-5',
      'anthropic/claude-sonnet-4'
    ]);
  });
});
