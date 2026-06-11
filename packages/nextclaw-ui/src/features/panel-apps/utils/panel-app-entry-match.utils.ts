import type { PanelAppEntryView } from '@/shared/lib/api';

function isPanelAppEntryMatch(entry: PanelAppEntryView, value: string): boolean {
  const normalizedValue = value.trim();
  return [entry.id, entry.appId, entry.fileName, entry.title].some((candidate) => candidate.trim() === normalizedValue);
}

export function findPanelAppEntryByDisplayId(
  entries: readonly PanelAppEntryView[],
  value: string,
): PanelAppEntryView | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  return entries.find((entry) => isPanelAppEntryMatch(entry, normalizedValue)) ?? null;
}
