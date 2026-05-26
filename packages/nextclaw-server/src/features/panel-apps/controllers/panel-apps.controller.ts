import type { Context } from "hono";
import { isPanelAppError, type PanelAppManager } from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

function statusForPanelAppError(code: string): 400 | 404 {
  return code === "PANEL_APP_NOT_FOUND" ? 404 : 400;
}

export class PanelAppsRoutesController {
  constructor(private readonly panelAppManager: PanelAppManager) {}

  readonly list = async (c: Context) => {
    const payload = await this.panelAppManager.listPanelApps();
    return c.json(ok(payload));
  };

  readonly updatePanelAppPreferences = async (c: Context) => {
    const body = await readJson<unknown>(c.req.raw);
    if (!body.ok || !isRecord(body.data)) {
      return c.json(err("INVALID_PANEL_APP_PREFERENCES", "invalid panel app preferences"), 400);
    }
    try {
      const preferences = typeof body.data.favorite === "boolean"
        ? { favorite: body.data.favorite }
        : {};
      const payload = await this.panelAppManager.updatePanelAppPreferences(
        c.req.param("id"),
        preferences,
      );
      return c.json(ok(payload));
    } catch (error) {
      if (isPanelAppError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPanelAppError(error.code),
        );
      }
      throw error;
    }
  };

  readonly recordPanelAppOpened = async (c: Context) => {
    try {
      const payload = await this.panelAppManager.recordPanelAppOpened(c.req.param("id"));
      return c.json(ok(payload));
    } catch (error) {
      if (isPanelAppError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPanelAppError(error.code),
        );
      }
      throw error;
    }
  };

  readonly getPanelAppContent = async (c: Context): Promise<Response> => {
    try {
      const payload = await this.panelAppManager.getPanelAppContent(
        c.req.param("id"),
      );
      return new Response(payload.html, {
        headers: {
          "content-type": payload.contentType,
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      if (isPanelAppError(error)) {
        return c.json(
          err(error.code, error.message),
          statusForPanelAppError(error.code),
        );
      }
      throw error;
    }
  };
}
