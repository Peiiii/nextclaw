import {
  useRecentSelectionStore,
  normalizeRecentSelectionList,
  normalizeRecentSelectionValue,
  resolveRecentSelectionKey,
  type RecentSelectionScope,
} from '@/features/chat/stores/recent-selection.store';

type RecentSelectionManagerOptions = {
  storageKey: string;
  limit: number;
};

type VisibleRecentSelectionParams = {
  availableValues: string[];
  minAvailableCount: number;
  limit?: number;
} & RecentSelectionScope;

export class RecentSelectionManager {
  constructor(private readonly options: RecentSelectionManagerOptions) {}

  read = (scope: RecentSelectionScope = {}): string[] => {
    const key = resolveRecentSelectionKey(this.options, scope);
    return normalizeRecentSelectionList(useRecentSelectionStore.getState().entriesByKey[key], this.options.limit);
  };

  remember = (value: string, scope: RecentSelectionScope = {}): string[] => {
    const normalizedValue = normalizeRecentSelectionValue(value);
    if (!normalizedValue) {
      return this.read(scope);
    }
    const key = resolveRecentSelectionKey(this.options, scope);
    const next = [normalizedValue, ...this.read(scope).filter((item) => item !== normalizedValue)]
      .slice(0, this.options.limit);
    useRecentSelectionStore.getState().setEntries(key, next);
    return next;
  };

  resolveVisible = (params: VisibleRecentSelectionParams): string[] => {
    const availableValues = normalizeRecentSelectionList(params.availableValues, Number.POSITIVE_INFINITY);
    if (availableValues.length <= params.minAvailableCount) {
      return [];
    }
    const availableSet = new Set(availableValues);
    const visible: string[] = [];
    const maxVisibleItems = Math.max(1, params.limit ?? this.options.limit);
    for (const value of this.read(params)) {
      if (!availableSet.has(value) || visible.includes(value)) {
        continue;
      }
      visible.push(value);
      if (visible.length >= maxVisibleItems) {
        break;
      }
    }
    return visible;
  };
}
