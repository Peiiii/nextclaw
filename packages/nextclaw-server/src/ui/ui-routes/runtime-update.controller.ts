import type { Context } from "hono";
import type { UpdatePreferences, UpdateSnapshot } from "@nextclaw/kernel";
import { err, formatUserFacingError, ok, readJson } from "./response.js";
import type { UiRuntimeUpdateHost } from "./types.js";

type RuntimeUpdatePreferencesRequest = Partial<UpdatePreferences>;
type RuntimeUpdateChannelRequest = {
  channel?: UpdateSnapshot["channel"];
};

export class RuntimeUpdateRoutesController {
  constructor(private readonly host: UiRuntimeUpdateHost) {}

  readonly getState = async (c: Context) => {
    try {
      return c.json(ok(await this.host.getState()));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_STATE_FAILED", formatUserFacingError(error)), 500);
    }
  };

  readonly checkForUpdates = async (c: Context) => {
    try {
      return c.json(ok(await this.host.checkForUpdates()));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_CHECK_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly downloadUpdate = async (c: Context) => {
    try {
      return c.json(ok(await this.host.downloadUpdate()));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_DOWNLOAD_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly applyDownloadedUpdate = async (c: Context) => {
    try {
      return c.json(ok(await this.host.applyDownloadedUpdate()));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_APPLY_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly updatePreferences = async (c: Context) => {
    const body = await readJson<RuntimeUpdatePreferencesRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    try {
      return c.json(ok(await this.host.updatePreferences({
        ...(typeof body.data.automaticChecks === "boolean" ? { automaticChecks: body.data.automaticChecks } : {}),
        ...(typeof body.data.autoDownload === "boolean" ? { autoDownload: body.data.autoDownload } : {})
      })));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_PREFERENCES_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly updateChannel = async (c: Context) => {
    const body = await readJson<RuntimeUpdateChannelRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const channel = body.data.channel;
    if (channel !== "stable" && channel !== "beta") {
      return c.json(err("INVALID_BODY", "channel must be stable or beta"), 400);
    }

    try {
      return c.json(ok(await this.host.updateChannel(channel)));
    } catch (error) {
      return c.json(err("RUNTIME_UPDATE_CHANNEL_FAILED", formatUserFacingError(error)), 400);
    }
  };
}
