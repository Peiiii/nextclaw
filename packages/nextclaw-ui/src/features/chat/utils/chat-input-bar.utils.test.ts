import {
  buildChatSlashItems,
  buildModelToolbarSelect,
  buildSelectedSkillItems,
  buildSkillPickerModel
} from './chat-input-bar.utils';
import type { ChatSkillRecord } from './chat-input-bar.utils';

function createSkillRecord(partial: Partial<ChatSkillRecord>): ChatSkillRecord {
  return {
    key: 'demo.skill',
    label: 'Demo Skill',
    ...partial
  };
}

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
});

describe('buildSelectedSkillItems', () => {
  it('keeps selected specs and resolves labels when available', () => {
    const chips = buildSelectedSkillItems(
      ['web-search', 'missing-skill'],
      [createSkillRecord({ key: 'web-search', label: 'Web Search' })]
    );

    expect(chips).toEqual([
      { key: 'web-search', label: 'Web Search' },
      { key: 'missing-skill', label: 'missing-skill' }
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
      texts: {
        modelSelectPlaceholder: 'Select model',
        modelNoOptionsLabel: 'No models',
        recentModelsLabel: 'Recent',
        allModelsLabel: 'All models'
      }
    });

    expect(select.value).toBe('minimax/MiniMax-M2.7');
    expect(select.selectedLabel).toBe('MiniMax/MiniMax-M2.7');
    expect(select.options[0]).toEqual({
      value: 'minimax/MiniMax-M2.7',
      label: 'MiniMax/MiniMax-M2.7'
    });
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
      texts: {
        modelSelectPlaceholder: 'Select model',
        modelNoOptionsLabel: 'No models',
        recentModelsLabel: 'Recent',
        allModelsLabel: 'All models'
      }
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
      texts: {
        modelSelectPlaceholder: 'Select model',
        modelNoOptionsLabel: 'No models',
        recentModelsLabel: 'Recent',
        allModelsLabel: 'All models'
      }
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
      texts: {
        modelSelectPlaceholder: 'Select model',
        modelNoOptionsLabel: 'No models',
        recentModelsLabel: 'Recent',
        allModelsLabel: 'All models'
      }
    });

    expect(select.groups?.[0]?.options.map((option) => option.value)).toEqual([
      'deepseek/deepseek-chat',
      'openai/gpt-5',
      'anthropic/claude-sonnet-4'
    ]);
  });
});
