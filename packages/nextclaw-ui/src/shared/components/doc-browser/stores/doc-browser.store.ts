import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DocBrowserMode,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import { createDefaultDocBrowserState } from '@/shared/components/doc-browser/utils/doc-browser-state.utils';

const DOC_BROWSER_STORAGE_KEY = 'nextclaw.doc-browser.state';
const DOC_BROWSER_STORAGE_VERSION = 1;
const DOC_BROWSER_MAX_PERSISTED_TABS = 8;

type PersistedDocBrowserState = Partial<DocBrowserState>;

type DocBrowserStore = {
  snapshot: DocBrowserState;
  setSnapshot: (next: DocBrowserStateUpdate) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isDocBrowserMode(value: unknown): value is DocBrowserMode {
  return value === 'floating' || value === 'docked';
}

function normalizePersistedStringList(value: unknown, fallback: string): string[] {
  if (!Array.isArray(value)) {
    return [fallback];
  }
  const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return values.length > 0 ? values : [fallback];
}

function normalizePersistedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizePersistedDocBrowserTab(value: unknown): DocBrowserTab | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.kind !== 'string'
    || typeof value.title !== 'string'
    || typeof value.currentUrl !== 'string'
    || value.currentUrl.trim().length === 0
  ) {
    return null;
  }
  const history = normalizePersistedStringList(value.history, value.currentUrl);
  const historyIndex = normalizePersistedNumber(value.historyIndex, 0, history.length - 1, history.length - 1);
  const navVersion = normalizePersistedNumber(value.navVersion, 0, Number.MAX_SAFE_INTEGER, 0);
  const dedupeKey = typeof value.dedupeKey === 'string' && value.dedupeKey.trim().length > 0
    ? value.dedupeKey
    : undefined;

  return {
    id: value.id,
    kind: value.kind,
    title: value.title,
    currentUrl: history[historyIndex] ?? value.currentUrl,
    dedupeKey,
    history,
    historyIndex,
    navVersion,
  };
}

function normalizePersistedDocBrowserState(value: unknown): DocBrowserState | null {
  if (!isRecord(value)) {
    return null;
  }
  const tabs = Array.isArray(value.tabs)
    ? value.tabs
      .map(normalizePersistedDocBrowserTab)
      .filter((tab): tab is DocBrowserTab => tab !== null)
      .slice(-DOC_BROWSER_MAX_PERSISTED_TABS)
    : [];
  if (tabs.length === 0) {
    return null;
  }
  const persistedActiveTabId = typeof value.activeTabId === 'string' ? value.activeTabId : null;
  const activeTabId = tabs.some((tab) => tab.id === persistedActiveTabId)
    ? persistedActiveTabId ?? tabs[0].id
    : tabs[0].id;

  return {
    isOpen: value.isOpen === true,
    mode: isDocBrowserMode(value.mode) ? value.mode : 'docked',
    tabs,
    activeTabId,
  };
}

function resolveDocBrowserStateUpdate(prev: DocBrowserState, next: DocBrowserStateUpdate): DocBrowserState {
  if (typeof next === 'function') {
    return next(prev);
  }
  return next;
}

export const useDocBrowserStore = create<DocBrowserStore>()(
  persist(
    (set) => ({
      snapshot: createDefaultDocBrowserState(),
      setSnapshot: (next) => set((prev) => ({
        snapshot: resolveDocBrowserStateUpdate(prev.snapshot, next),
      })),
    }),
    {
      name: DOC_BROWSER_STORAGE_KEY,
      version: DOC_BROWSER_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): { snapshot: PersistedDocBrowserState } => ({
        snapshot: {
          isOpen: state.snapshot.isOpen,
          mode: state.snapshot.mode,
          tabs: state.snapshot.tabs.slice(-DOC_BROWSER_MAX_PERSISTED_TABS),
          activeTabId: state.snapshot.activeTabId,
        },
      }),
      merge: (persistedState, currentState) => {
        const persistedSnapshot = isRecord(persistedState) ? persistedState.snapshot : null;
        const normalizedSnapshot = normalizePersistedDocBrowserState(persistedSnapshot);
        if (!normalizedSnapshot) {
          return currentState;
        }
        return {
          ...currentState,
          snapshot: normalizedSnapshot,
        };
      },
    },
  ),
);
