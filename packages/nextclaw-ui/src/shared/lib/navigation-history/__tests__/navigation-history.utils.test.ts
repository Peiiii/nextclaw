import { describe, expect, it } from 'vitest';
import {
  filterNavigationHistoryEntries,
  pushNavigationHistoryEntry,
  stepNavigationHistory,
} from '../navigation-history.utils';

describe('navigation-history utils', () => {
  it('pushes new entries and truncates forward history after stepping back', () => {
    const initial = pushNavigationHistoryEntry({ entries: [], index: 0 }, 'a');
    const second = pushNavigationHistoryEntry(initial, 'b');
    const third = pushNavigationHistoryEntry(second, 'c');
    const stepped = stepNavigationHistory(third, 'back');

    expect(stepped?.entry).toBe('b');

    const next = pushNavigationHistoryEntry(stepped!.history, 'd');

    expect(next).toEqual({
      entries: ['a', 'b', 'd'],
      index: 2,
    });
  });

  it('does not duplicate the current entry when the matcher says it is the same', () => {
    const history = pushNavigationHistoryEntry(
      { entries: [{ id: 'a' }], index: 0 },
      { id: 'a' },
      (current, next) => current.id === next.id,
    );

    expect(history.entries).toEqual([{ id: 'a' }]);
    expect(history.index).toBe(0);
  });

  it('filters entries while keeping the nearest surviving current position', () => {
    const history = filterNavigationHistoryEntries(
      { entries: ['a', 'b', 'c', 'b'], index: 2 },
      (entry) => entry !== 'b',
    );

    expect(history).toEqual({
      entries: ['a', 'c'],
      index: 1,
    });
  });

  it('uses the fallback entry when every entry is filtered out', () => {
    expect(
      filterNavigationHistoryEntries(
        { entries: ['a'], index: 0 },
        () => false,
        'home',
      ),
    ).toEqual({
      entries: ['home'],
      index: 0,
    });
  });
});
