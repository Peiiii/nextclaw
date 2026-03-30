type RecentSelectionManagerOptions = {
  storageKey: string;
  limit: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
};

type VisibleRecentSelectionParams = {
  availableValues: string[];
  minAvailableCount: number;
  limit?: number;
};

export class RecentSelectionManager {
  constructor(private readonly options: RecentSelectionManagerOptions) {}

  read(): string[] {
    const storage = this.getStorage();
    if (!storage) {
      return [];
    }
    try {
      return this.normalizeList(JSON.parse(storage.getItem(this.options.storageKey) ?? '[]'));
    } catch {
      return [];
    }
  }

  remember(value: string): string[] {
    const normalizedValue = this.normalizeValue(value);
    if (!normalizedValue) {
      return this.read();
    }
    const next = [normalizedValue, ...this.read().filter((item) => item !== normalizedValue)].slice(0, this.options.limit);
    this.write(next);
    return next;
  }

  resolveVisible(params: VisibleRecentSelectionParams): string[] {
    const availableValues = this.normalizeList(params.availableValues, Number.POSITIVE_INFINITY);
    if (availableValues.length <= params.minAvailableCount) {
      return [];
    }
    const availableSet = new Set(availableValues);
    const visible: string[] = [];
    const maxVisibleItems = Math.max(1, params.limit ?? this.options.limit);
    for (const value of this.read()) {
      if (!availableSet.has(value) || visible.includes(value)) {
        continue;
      }
      visible.push(value);
      if (visible.length >= maxVisibleItems) {
        break;
      }
    }
    return visible;
  }

  private write(values: string[]): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(this.options.storageKey, JSON.stringify(this.normalizeList(values)));
    } catch {
      // Ignore storage write failures and keep the runtime behavior deterministic.
    }
  }

  private getStorage(): Storage | null {
    if (Object.prototype.hasOwnProperty.call(this.options, 'storage')) {
      return (this.options.storage as Storage | null | undefined) ?? null;
    }
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage;
  }

  private normalizeList(values: unknown, limit = this.options.limit): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    const deduped: string[] = [];
    for (const value of values) {
      const normalized = this.normalizeValue(value);
      if (!normalized || deduped.includes(normalized)) {
        continue;
      }
      deduped.push(normalized);
      if (deduped.length >= limit) {
        break;
      }
    }
    return deduped;
  }

  private normalizeValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
}
