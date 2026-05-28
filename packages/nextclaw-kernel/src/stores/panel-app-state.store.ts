import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

const PANEL_APP_STATE_FILE = ".panel-apps.state.json";
const PANEL_APP_STATE_VERSION = 1;

export type PanelAppStateEntry = {
  favorite?: boolean;
  lastOpenedAt?: string;
  openCount?: number;
};

export type PanelAppStateSnapshot = Record<string, PanelAppStateEntry>;

type PanelAppStateFile = {
  version: typeof PANEL_APP_STATE_VERSION;
  apps: PanelAppStateSnapshot;
};

export type PanelAppPreferencesUpdate = {
  favorite?: boolean;
};

export class PanelAppStateStore {
  constructor(private readonly panelsPath: string) {}

  load = async (): Promise<PanelAppStateSnapshot> => {
    try {
      const parsed = JSON.parse(await readFile(this.getStatePath(), "utf8")) as unknown;
      return this.normalizeStateFile(parsed).apps;
    } catch (error) {
      if (this.isMissingFileError(error) || error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  };

  updatePreferences = async (
    id: string,
    preferences: PanelAppPreferencesUpdate,
  ): Promise<PanelAppStateEntry> => {
    const apps = await this.load();
    const current = apps[id] ?? {};
    const next = { ...current };
    if (typeof preferences.favorite === "boolean") {
      next.favorite = preferences.favorite;
    }
    apps[id] = next;
    await this.persist(apps);
    return next;
  };

  recordOpened = async (id: string, openedAt = new Date()): Promise<PanelAppStateEntry> => {
    const apps = await this.load();
    const current = apps[id] ?? {};
    const next = {
      ...current,
      lastOpenedAt: openedAt.toISOString(),
      openCount: Math.max(0, current.openCount ?? 0) + 1,
    };
    apps[id] = next;
    await this.persist(apps);
    return next;
  };

  deleteEntry = async (id: string): Promise<void> => {
    const apps = await this.load();
    if (!(id in apps)) {
      return;
    }
    delete apps[id];
    await this.persist(apps);
  };

  private persist = async (apps: PanelAppStateSnapshot): Promise<void> => {
    const statePath = this.getStatePath();
    const tempPath = `${statePath}.${randomUUID()}.tmp`;
    const stateFile: PanelAppStateFile = {
      version: PANEL_APP_STATE_VERSION,
      apps,
    };
    await mkdir(dirname(statePath), { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(stateFile, null, 2)}\n`, "utf8");
      await rename(tempPath, statePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  private getStatePath = (): string => join(this.panelsPath, PANEL_APP_STATE_FILE);

  private normalizeStateFile = (value: unknown): PanelAppStateFile => {
    if (!this.isRecord(value) || !this.isRecord(value.apps)) {
      return { version: PANEL_APP_STATE_VERSION, apps: {} };
    }
    const apps = Object.fromEntries(
      Object.entries(value.apps).flatMap(([id, entry]) => {
        if (!this.isRecord(entry)) {
          return [];
        }
        return [[id, this.normalizeStateEntry(entry)]];
      }),
    );
    return { version: PANEL_APP_STATE_VERSION, apps };
  };

  private normalizeStateEntry = (entry: Record<string, unknown>): PanelAppStateEntry => {
    const normalized: PanelAppStateEntry = {};
    if (typeof entry.favorite === "boolean") {
      normalized.favorite = entry.favorite;
    }
    if (typeof entry.lastOpenedAt === "string") {
      normalized.lastOpenedAt = entry.lastOpenedAt;
    }
    if (typeof entry.openCount === "number") {
      normalized.openCount = entry.openCount;
    }
    return normalized;
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
