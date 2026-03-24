import {
  buildChatSlashItems,
  buildModelToolbarSelect,
  buildSelectedSkillItems,
  buildSkillPickerModel
} from '@/components/chat/adapters/chat-input-bar.adapter';
import type { ChatSkillRecord } from '@/components/chat/adapters/chat-input-bar.adapter';

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
      selectedSkills: ['web-search'],
      isLoading: false,
      onSelectedKeysChange,
      texts: {
        title: 'Skills',
        searchPlaceholder: 'Search skills',
        emptyLabel: 'No skills',
        loadingLabel: 'Loading',
        manageLabel: 'Manage'
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
      selectedModel: 'dashscope/qwen3-coder-next',
      isModelOptionsLoading: false,
      hasModelOptions: true,
      onValueChange,
      texts: {
        modelSelectPlaceholder: 'Select model',
        modelNoOptionsLabel: 'No models'
      }
    });

    expect(select.value).toBe('minimax/MiniMax-M2.7');
    expect(select.selectedLabel).toBe('MiniMax/MiniMax-M2.7');
  });
});
