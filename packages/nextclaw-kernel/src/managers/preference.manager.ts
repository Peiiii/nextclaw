import { PreferenceStore } from "@kernel/stores/preference.store.js";
import type { PreferenceEntry, PreferenceJsonValue } from "@kernel/types/preference.types.js";

export type PreferenceManagerOptions = {
  storePath: string;
};

export type PreferenceErrorCode =
  | "PREFERENCE_INVALID_KEY"
  | "PREFERENCE_INVALID_VALUE";

export class PreferenceError extends Error {
  constructor(
    readonly code: PreferenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PreferenceError";
  }
}

export function isPreferenceError(error: unknown): error is PreferenceError {
  return error instanceof PreferenceError;
}

export class PreferenceManager {
  private readonly store: PreferenceStore;

  constructor(options: PreferenceManagerOptions) {
    this.store = new PreferenceStore(options.storePath);
  }

  getPreference = async (key: string): Promise<PreferenceEntry | null> => {
    return await this.store.get(this.normalizeKey(key));
  };

  setPreference = async (
    key: string,
    value: PreferenceJsonValue,
  ): Promise<PreferenceEntry> => {
    if (value === undefined || !this.isJsonValue(value)) {
      throw new PreferenceError("PREFERENCE_INVALID_VALUE", "preference value must be JSON serializable");
    }
    return await this.store.set(this.normalizeKey(key), value);
  };

  deletePreference = async (key: string): Promise<boolean> => {
    return await this.store.delete(this.normalizeKey(key));
  };

  private normalizeKey = (key: string): string => {
    const normalized = key.trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(normalized)) {
      throw new PreferenceError("PREFERENCE_INVALID_KEY", "preference key is invalid");
    }
    return normalized;
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
      return Object.values(value as Record<string, unknown>).every((item) => this.isJsonValue(item));
    }
    return false;
  };

  private isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}
