import type { Stats } from "node:fs";

export type PanelAppActivityRecord = {
  createdAt: string;
  lastOpenedAt?: string;
  updatedAt: string;
};

export function resolvePanelAppCreatedAt(fileStat: Stats): string {
  return fileStat.birthtimeMs > 0 ? fileStat.birthtime.toISOString() : fileStat.mtime.toISOString();
}

export function resolvePanelAppActivityMs(entry: PanelAppActivityRecord): number {
  return Math.max(
    new Date(entry.lastOpenedAt ?? 0).getTime(),
    new Date(entry.createdAt).getTime(),
    new Date(entry.updatedAt).getTime(),
  );
}
