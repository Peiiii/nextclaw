import type { PanelAppEntryView } from '@/shared/lib/api';

export type PanelAppViewMode = 'smart' | 'favorites' | 'recent-open' | 'updated' | 'name';

export function getPanelAppViewEntries(entries: PanelAppEntryView[], mode: PanelAppViewMode): PanelAppEntryView[] {
  if (mode === 'favorites') {
    return sortPanelApps(entries.filter((entry) => entry.favorite), 'smart');
  }
  if (mode === 'recent-open') {
    return sortPanelApps(entries.filter((entry) => entry.lastOpenedAt), mode);
  }
  return sortPanelApps(entries, mode);
}

function sortPanelApps(entries: PanelAppEntryView[], mode: Exclude<PanelAppViewMode, 'favorites'>): PanelAppEntryView[] {
  return [...entries].sort((left, right) => comparePanelApps(left, right, mode));
}

function comparePanelApps(left: PanelAppEntryView, right: PanelAppEntryView, mode: Exclude<PanelAppViewMode, 'favorites'>): number {
  if (mode === 'recent-open') {
    return compareIsoDesc(left.lastOpenedAt, right.lastOpenedAt) || compareByName(left, right);
  }
  if (mode === 'updated') {
    return compareIsoDesc(left.updatedAt, right.updatedAt) || compareByName(left, right);
  }
  if (mode === 'name') {
    return compareByName(left, right);
  }
  return (
    comparePanelAppActivityDesc(left, right) ||
    Number(right.favorite) - Number(left.favorite) ||
    compareByName(left, right)
  );
}

function compareByName(left: PanelAppEntryView, right: PanelAppEntryView): number {
  return left.title.localeCompare(right.title);
}

function comparePanelAppActivityDesc(left: PanelAppEntryView, right: PanelAppEntryView): number {
  return resolvePanelAppActivityMs(right) - resolvePanelAppActivityMs(left);
}

function resolvePanelAppActivityMs(entry: PanelAppEntryView): number {
  return Math.max(
    new Date(entry.lastOpenedAt ?? 0).getTime(),
    new Date(entry.createdAt).getTime(),
    new Date(entry.updatedAt).getTime(),
  );
}

function compareIsoDesc(left?: string, right?: string): number {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}
