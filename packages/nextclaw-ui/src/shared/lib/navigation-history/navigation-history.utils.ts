export type NavigationHistoryDirection = 'back' | 'forward';

export type NavigationHistoryState<Entry> = {
  entries: readonly Entry[];
  index: number;
};

export type NavigationHistoryStep<Entry> = {
  history: NavigationHistoryState<Entry>;
  entry: Entry;
};

export type NavigationHistoryEntryMatcher<Entry> = (
  current: Entry,
  next: Entry,
) => boolean;

export function canGoBackInNavigationHistory<Entry>(
  history: NavigationHistoryState<Entry>,
): boolean {
  return history.index > 0 && history.entries.length > 0;
}

export function canGoForwardInNavigationHistory<Entry>(
  history: NavigationHistoryState<Entry>,
): boolean {
  return history.index >= 0 && history.index < history.entries.length - 1;
}

export function pushNavigationHistoryEntry<Entry>(
  history: NavigationHistoryState<Entry>,
  entry: Entry,
  isSameEntry: NavigationHistoryEntryMatcher<Entry> = Object.is,
): NavigationHistoryState<Entry> {
  const normalizedIndex = normalizeNavigationHistoryIndex(history);
  const current = history.entries[normalizedIndex];
  if (current && isSameEntry(current, entry)) {
    return {
      entries: history.entries,
      index: normalizedIndex,
    };
  }
  const entries = [...history.entries.slice(0, normalizedIndex + 1), entry];
  return {
    entries,
    index: entries.length - 1,
  };
}

export function stepNavigationHistory<Entry>(
  history: NavigationHistoryState<Entry>,
  direction: NavigationHistoryDirection,
): NavigationHistoryStep<Entry> | null {
  const normalizedIndex = normalizeNavigationHistoryIndex(history);
  const nextIndex = direction === 'back'
    ? normalizedIndex - 1
    : normalizedIndex + 1;
  const entry = history.entries[nextIndex];
  if (!entry) {
    return null;
  }
  return {
    history: {
      entries: history.entries,
      index: nextIndex,
    },
    entry,
  };
}

export function filterNavigationHistoryEntries<Entry>(
  history: NavigationHistoryState<Entry>,
  shouldKeep: (entry: Entry) => boolean,
  fallbackEntry?: Entry,
): NavigationHistoryState<Entry> {
  const normalizedIndex = normalizeNavigationHistoryIndex(history);
  const keptEntries = history.entries.filter(shouldKeep);
  if (keptEntries.length === 0) {
    return fallbackEntry === undefined
      ? { entries: [], index: 0 }
      : { entries: [fallbackEntry], index: 0 };
  }
  const keptBeforeOrAtCurrent = history.entries
    .slice(0, normalizedIndex + 1)
    .filter(shouldKeep);
  return {
    entries: keptEntries,
    index: Math.min(
      Math.max(0, keptBeforeOrAtCurrent.length - 1),
      keptEntries.length - 1,
    ),
  };
}

function normalizeNavigationHistoryIndex<Entry>(
  history: NavigationHistoryState<Entry>,
): number {
  if (history.entries.length === 0) {
    return 0;
  }
  if (!Number.isInteger(history.index)) {
    return history.entries.length - 1;
  }
  return Math.min(Math.max(0, history.index), history.entries.length - 1);
}
