import { RecentSelectionManager } from '@/features/chat/managers/recent-selection.manager';
import { useRecentSelectionStore } from '@/features/chat/stores/recent-selection.store';

describe('RecentSelectionManager', () => {
  const storageKey = 'test.recent-selection-manager';

  beforeEach(() => {
    window.localStorage.clear();
    useRecentSelectionStore.setState({ entriesByKey: {} });
  });

  it('stores recent values in LRU order and respects the size limit', () => {
    const manager = new RecentSelectionManager({ storageKey, limit: 3 });

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
    const manager = new RecentSelectionManager({ storageKey, limit: 4 });
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
    window.localStorage.setItem(storageKey, '{broken-json');
    const manager = new RecentSelectionManager({ storageKey, limit: 3 });

    expect(manager.read()).toEqual([]);
  });

  it('does not mutate an empty store while reading recent values', () => {
    const manager = new RecentSelectionManager({ storageKey, limit: 3 });

    expect(manager.read()).toEqual([]);
    expect(useRecentSelectionStore.getState().entriesByKey).toEqual({});
  });

  it('keeps namespaced recent values separate from the global list', () => {
    const manager = new RecentSelectionManager({ storageKey, limit: 3 });

    manager.remember('openai/gpt-5');
    manager.remember('anthropic/claude-sonnet-4', { namespace: 'codex' });
    manager.remember('minimax/MiniMax-M2.7', { namespace: 'hermes' });
    manager.remember('openai/gpt-5.1', { namespace: 'codex' });

    expect(manager.read()).toEqual(['openai/gpt-5']);
    expect(manager.read({ namespace: 'codex' })).toEqual([
      'openai/gpt-5.1',
      'anthropic/claude-sonnet-4'
    ]);
    expect(
      manager.resolveVisible({
        namespace: 'hermes',
        availableValues: ['minimax/MiniMax-M2.7', 'openai/gpt-5'],
        minAvailableCount: 0
      })
    ).toEqual(['minimax/MiniMax-M2.7']);
  });
});
