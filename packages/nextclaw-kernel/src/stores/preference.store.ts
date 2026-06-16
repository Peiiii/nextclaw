import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PreferenceEntry, PreferenceJsonValue } from "@kernel/types/preference.types.js";

const PREFERENCE_STORE_VERSION = 1;

type PreferenceStoreFile = {
  version: typeof PREFERENCE_STORE_VERSION;
  entries: Record<string, PreferenceEntry>;
};

export class PreferenceStore {
  constructor(private readonly storePath: string) {}

  get = async (key: string): Promise<PreferenceEntry | null> => {
    return (await this.load())[key] ?? null;
  };

  set = async (
    key: string,
    value: PreferenceJsonValue,
    updatedAt = new Date(),
  ): Promise<PreferenceEntry> => {
    const entries = await this.load();
    const entry: PreferenceEntry = {
      key,
      value,
      updatedAt: updatedAt.toISOString(),
    };
    entries[key] = entry;
    await this.persist(entries);
    return entry;
  };

  delete = async (key: string): Promise<boolean> => {
    const entries = await this.load();
    if (!(key in entries)) {
      return false;
    }
    delete entries[key];
    await this.persist(entries);
    return true;
  };

  private load = async (): Promise<Record<string, PreferenceEntry>> => {
    try {
      const parsed = JSON.parse(await readFile(this.storePath, "utf8")) as unknown;
      return this.normalizeStoreFile(parsed).entries;
    } catch (error) {
      if (this.isMissingFileError(error) || error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  };

  private persist = async (entries: Record<string, PreferenceEntry>): Promise<void> => {
    const tempPath = `${this.storePath}.${randomUUID()}.tmp`;
    const storeFile: PreferenceStoreFile = {
      version: PREFERENCE_STORE_VERSION,
      entries,
    };
    await mkdir(dirname(this.storePath), { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(storeFile, null, 2)}\n`, "utf8");
      await rename(tempPath, this.storePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  private normalizeStoreFile = (value: unknown): PreferenceStoreFile => {
    if (!this.isRecord(value) || !this.isRecord(value.entries)) {
      return { version: PREFERENCE_STORE_VERSION, entries: {} };
    }
    const entries = Object.fromEntries(
      Object.entries(value.entries).flatMap(([key, entry]) => {
        if (!this.isRecord(entry) || !this.isJsonValue(entry.value)) {
          return [];
        }
        return [[key, {
          key,
          value: entry.value,
          updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date(0).toISOString(),
        } satisfies PreferenceEntry]];
      }),
    );
    return { version: PREFERENCE_STORE_VERSION, entries };
  };

  private isJsonValue = (value: unknown): value is PreferenceJsonValue => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item));
    }
    if (this.isPlainRecord(value)) {
      return Object.values(value).every((item) => this.isJsonValue(item));
    }
    return false;
  };

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    this.isPlainRecord(value);

  private isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
