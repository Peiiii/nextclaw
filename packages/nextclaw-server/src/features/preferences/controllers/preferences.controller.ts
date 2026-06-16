import type { Context } from "hono";
import {
  isPreferenceError,
  type PreferenceManager,
} from "@nextclaw/kernel";
import type {
  PreferenceDeleteResult,
  PreferenceEntryView,
  PreferenceUpdateRequest,
} from "@nextclaw-server/features/preferences/types/preferences-api.types.js";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

function statusForPreferenceError(code: string): 400 {
  void code;
  return 400;
}

export class PreferencesRoutesController {
  constructor(private readonly preferenceManager: PreferenceManager) {}

  readonly get = async (c: Context) => {
    try {
      const entry = await this.preferenceManager.getPreference(c.req.param("key"));
      const payload: PreferenceEntryView = entry
        ? {
            key: entry.key,
            value: entry.value,
            updatedAt: entry.updatedAt,
          }
        : {
            key: c.req.param("key"),
            value: null,
          };
      return c.json(ok(payload));
    } catch (error) {
      if (isPreferenceError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPreferenceError(error.code),
        );
      }
      throw error;
    }
  };

  readonly update = async (c: Context) => {
    const body = await readJson<PreferenceUpdateRequest>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || !Object.hasOwn(body.data, "value")) {
      return c.json(err("INVALID_PREFERENCE", "preference value is required"), 400);
    }
    try {
      const entry = await this.preferenceManager.setPreference(
        c.req.param("key"),
        body.data.value,
      );
      return c.json(ok({
        key: entry.key,
        value: entry.value,
        updatedAt: entry.updatedAt,
      } satisfies PreferenceEntryView));
    } catch (error) {
      if (isPreferenceError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPreferenceError(error.code),
        );
      }
      throw error;
    }
  };

  readonly delete = async (c: Context) => {
    try {
      const key = c.req.param("key");
      const deleted = await this.preferenceManager.deletePreference(key);
      return c.json(ok({
        key,
        deleted,
      } satisfies PreferenceDeleteResult));
    } catch (error) {
      if (isPreferenceError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPreferenceError(error.code),
        );
      }
      throw error;
    }
  };
}
