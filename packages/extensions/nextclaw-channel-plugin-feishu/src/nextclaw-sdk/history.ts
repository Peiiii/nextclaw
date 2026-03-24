import type { HistoryEntry } from "./types.js";

export const HISTORY_CONTEXT_MARKER = "[Chat messages since your last reply - for context]";
export const CURRENT_MESSAGE_MARKER = "[Current message]";
export const DEFAULT_GROUP_HISTORY_LIMIT = 50;
const MAX_HISTORY_KEYS = 1_000;

function evictOldHistoryKeys<T>(historyMap: Map<string, T[]>, maxKeys = MAX_HISTORY_KEYS): void {
  if (historyMap.size <= maxKeys) {
    return;
  }
  const keysToDelete = historyMap.size - maxKeys;
  const iterator = historyMap.keys();
  for (let index = 0; index < keysToDelete; index += 1) {
    const key = iterator.next().value;
    if (key !== undefined) {
      historyMap.delete(key);
    }
  }
}

function buildHistoryContext(params: {
  historyText: string;
  currentMessage: string;
  lineBreak?: string;
}): string {
  const lineBreak = params.lineBreak ?? "\n";
  if (!params.historyText.trim()) {
    return params.currentMessage;
  }
  return [
    HISTORY_CONTEXT_MARKER,
    params.historyText,
    "",
    CURRENT_MESSAGE_MARKER,
    params.currentMessage,
  ].join(lineBreak);
}

function appendHistoryEntry<T extends HistoryEntry>(params: {
  historyMap: Map<string, T[]>;
  historyKey: string;
  entry: T;
  limit: number;
}): T[] {
  if (params.limit <= 0) {
    return [];
  }
  const history = params.historyMap.get(params.historyKey) ?? [];
  history.push(params.entry);
  while (history.length > params.limit) {
    history.shift();
  }
  if (params.historyMap.has(params.historyKey)) {
    params.historyMap.delete(params.historyKey);
  }
  params.historyMap.set(params.historyKey, history);
  evictOldHistoryKeys(params.historyMap);
  return history;
}

function buildHistoryContextFromEntries(params: {
  entries: HistoryEntry[];
  currentMessage: string;
  formatEntry: (entry: HistoryEntry) => string;
  lineBreak?: string;
  excludeLast?: boolean;
}): string {
  const lineBreak = params.lineBreak ?? "\n";
  const entries = params.excludeLast === false ? params.entries : params.entries.slice(0, -1);
  if (entries.length === 0) {
    return params.currentMessage;
  }
  return buildHistoryContext({
    historyText: entries.map(params.formatEntry).join(lineBreak),
    currentMessage: params.currentMessage,
    lineBreak,
  });
}

export function recordPendingHistoryEntryIfEnabled<T extends HistoryEntry>(params: {
  historyMap: Map<string, T[]>;
  historyKey: string;
  entry?: T | null;
  limit: number;
}): T[] {
  if (!params.entry || params.limit <= 0) {
    return [];
  }
  return appendHistoryEntry({
    historyMap: params.historyMap,
    historyKey: params.historyKey,
    entry: params.entry,
    limit: params.limit,
  });
}

export function buildPendingHistoryContextFromMap(params: {
  historyMap: Map<string, HistoryEntry[]>;
  historyKey: string;
  limit: number;
  currentMessage: string;
  formatEntry: (entry: HistoryEntry) => string;
  lineBreak?: string;
}): string {
  if (params.limit <= 0) {
    return params.currentMessage;
  }
  return buildHistoryContextFromEntries({
    entries: params.historyMap.get(params.historyKey) ?? [],
    currentMessage: params.currentMessage,
    formatEntry: params.formatEntry,
    lineBreak: params.lineBreak,
    excludeLast: false,
  });
}

export function clearHistoryEntriesIfEnabled(params: {
  historyMap: Map<string, HistoryEntry[]>;
  historyKey: string;
  limit: number;
}): void {
  if (params.limit <= 0) {
    return;
  }
  params.historyMap.set(params.historyKey, []);
}
