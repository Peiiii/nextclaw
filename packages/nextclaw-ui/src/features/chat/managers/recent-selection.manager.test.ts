import { RecentSelectionManager } from './recent-selection.manager';

describe('RecentSelectionManager', () => {
  const storageKey = 'test.recent-selection-manager';
  let storageState: Record<string, string>;
  let storage: Pick<Storage, 'getItem' | 'setItem'>;

  beforeEach(() => {
    storageState = {};
    storage = {
      getItem: (key) => storageState[key] ?? null,
      setItem: (key, value) => {
        storageState[key] = value;
      }
    };
  });

  it('stores recent values in LRU order and respects the size limit', () => {
    const manager = new RecentSelectionManager({ storageKey, limit: 3, storage });

    manager.remember('openai/gpt-5');
    manager.remember('anthropic/claude-sonnet-4');
    manager.remember('minimax/MiniMax-M2.7');
    manager.remember('openai/gpt-5');

    expect(manager.read()).toEqual([
      'openai/gpt-5',
      'minimax/MiniMax-M2.7',
      'anthropic/claude-sonnet-4'
    ]);
  });

  it('filters recent values by the currently available list and threshold', () => {
    const manager = new RecentSelectionManager({ storageKey, limit: 4, storage });
    manager.remember('openai/gpt-5');
    manager.remember('anthropic/claude-sonnet-4');
    manager.remember('missing/model');

    expect(
      manager.resolveVisible({
        availableValues: [
          'openai/gpt-5',
          'anthropic/claude-sonnet-4',
          'minimax/MiniMax-M2.7',
          'deepseek/deepseek-chat',
          'openrouter/openai/gpt-4.1',
          'gemini/gemini-2.5-pro'
        ],
        minAvailableCount: 5,
        limit: 2
      })
    ).toEqual(['anthropic/claude-sonnet-4', 'openai/gpt-5']);

    expect(
      manager.resolveVisible({
        availableValues: ['openai/gpt-5', 'anthropic/claude-sonnet-4', 'minimax/MiniMax-M2.7'],
        minAvailableCount: 5
      })
    ).toEqual([]);
  });

  it('returns an empty list when storage content is malformed', () => {
    storageState[storageKey] = '{broken-json';
    const manager = new RecentSelectionManager({ storageKey, limit: 3, storage });

    expect(manager.read()).toEqual([]);
  });
});
