import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RecentSelectionScope = {
  namespace?: string | null;
};

type RecentSelectionStoreState = {
  entriesByKey: Record<string, string[]>;
  setEntries: (key: string, values: string[]) => void;
};

const RECENT_SELECTION_STORE_KEY = 'nextclaw.chat.recent-selection.store';

export function normalizeRecentSelectionValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeRecentSelectionList(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(
    new Set(values.map(normalizeRecentSelectionValue).filter((value): value is string => Boolean(value))),
  ).slice(0, limit);
}

export function resolveRecentSelectionKey(
  options: { storageKey: string },
  scope?: RecentSelectionScope,
): string {
  const namespace = normalizeRecentSelectionValue(scope?.namespace);
  return namespace
    ? `${options.storageKey}.${encodeURIComponent(namespace.toLowerCase())}`
    : options.storageKey;
}

function normalizePersistedEntries(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const entries: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(value)) {
    const normalizedKey = normalizeRecentSelectionValue(key);
    if (!normalizedKey) {
      continue;
    }
    const normalizedValues = normalizeRecentSelectionList(values, Number.POSITIVE_INFINITY);
    if (normalizedValues.length > 0) {
      entries[normalizedKey] = normalizedValues;
    }
  }
  return entries;
}

export const useRecentSelectionStore = create<RecentSelectionStoreState>()(
  persist(
    (set) => ({
      entriesByKey: {},
      setEntries: (key, values) => set((state) => ({
        entriesByKey: {
          ...state.entriesByKey,
          [key]: normalizeRecentSelectionList(values, Number.POSITIVE_INFINITY),
        },
      })),
    }),
    {
      name: RECENT_SELECTION_STORE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        entriesByKey: state.entriesByKey,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        entriesByKey: normalizePersistedEntries(
          (persistedState as { entriesByKey?: Record<string, unknown> } | undefined)?.entriesByKey,
        ),
      }),
    },
  ),
);
