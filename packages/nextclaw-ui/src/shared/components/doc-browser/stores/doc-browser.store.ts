import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DocBrowserActiveHistoryEntry,
  DocBrowserDockIcon,
  DocBrowserMode,
  DocBrowserState,
  DocBrowserStateUpdate,
  DocBrowserTab,
} from '@/shared/components/doc-browser/types/doc-browser.types';
import {
  createDefaultDocBrowserState,
  normalizeDocBrowserDockedWidth,
} from '@/shared/components/doc-browser/utils/doc-browser-state.utils';

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

function normalizePersistedDockIcon(value: unknown): DocBrowserDockIcon | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return undefined;
  }
  if (value.type === 'builtin' && typeof value.name === 'string' && value.name.trim().length > 0) {
    return { type: 'builtin', name: value.name.trim() };
  }
  if (value.type === 'url' && typeof value.url === 'string' && value.url.trim().length > 0) {
    return { type: 'url', url: value.url.trim() };
  }
  if (value.type === 'text' && typeof value.value === 'string' && value.value.trim().length > 0) {
    return { type: 'text', value: value.value.trim() };
  }
  return undefined;
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
  const resourceUri = typeof value.resourceUri === 'string' && value.resourceUri.trim().length > 0
    ? value.resourceUri.trim()
    : undefined;
  const dockIcon = normalizePersistedDockIcon(value.dockIcon);

  return {
    id: value.id,
    kind: value.kind,
    title: value.title,
    currentUrl: history[historyIndex] ?? value.currentUrl,
    resourceUri,
    dockIcon,
    dedupeKey,
    history,
    historyIndex,
    navVersion,
  };
}

function createActiveHistoryEntryFromTab(tab: DocBrowserTab): DocBrowserActiveHistoryEntry {
  return {
    kind: tab.kind,
    resourceUri: tab.resourceUri,
    tabId: tab.id,
    url: tab.currentUrl,
  };
}

function normalizePersistedActiveHistoryEntry(
  value: unknown,
  tabsById: Map<string, DocBrowserTab>,
): DocBrowserActiveHistoryEntry | null {
  if (
    !isRecord(value)
    || typeof value.tabId !== 'string'
    || typeof value.kind !== 'string'
    || typeof value.url !== 'string'
    || value.url.trim().length === 0
    || !tabsById.has(value.tabId)
  ) {
    return null;
  }

  const resourceUri = typeof value.resourceUri === 'string' && value.resourceUri.trim().length > 0
    ? value.resourceUri.trim()
    : undefined;

  return {
    kind: value.kind,
    resourceUri,
    tabId: value.tabId,
    url: value.url,
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
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const activeHistory = Array.isArray(value.activeHistory)
    ? value.activeHistory
      .map((entry) => normalizePersistedActiveHistoryEntry(entry, tabsById))
      .filter((entry): entry is DocBrowserActiveHistoryEntry => entry !== null)
    : [];
  const fallbackHistory = [createActiveHistoryEntryFromTab(tabsById.get(activeTabId) ?? tabs[0])];
  const resolvedActiveHistory = activeHistory.length > 0 ? activeHistory : fallbackHistory;
  const activeHistoryIndex = normalizePersistedNumber(
    value.activeHistoryIndex,
    0,
    resolvedActiveHistory.length - 1,
    resolvedActiveHistory.length - 1,
  );
  const activeHistoryEntry = resolvedActiveHistory[activeHistoryIndex];
  const resolvedActiveTabId = tabsById.has(activeHistoryEntry.tabId) ? activeHistoryEntry.tabId : activeTabId;

  return {
    isOpen: value.isOpen === true,
    mode: isDocBrowserMode(value.mode) ? value.mode : 'docked',
    dockedWidth: normalizeDocBrowserDockedWidth(value.dockedWidth),
    tabs,
    activeTabId: resolvedActiveTabId,
    activeHistory: resolvedActiveHistory,
    activeHistoryIndex,
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
          dockedWidth: state.snapshot.dockedWidth,
          tabs: state.snapshot.tabs.slice(-DOC_BROWSER_MAX_PERSISTED_TABS),
          activeTabId: state.snapshot.activeTabId,
          activeHistory: state.snapshot.activeHistory,
          activeHistoryIndex: state.snapshot.activeHistoryIndex,
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
