import type { Context } from "hono";
import { isPanelAppError, type PanelAppManager } from "@nextclaw/kernel";
import type { PanelAppBridgeSessionCreateRequest } from "@nextclaw-server/shared/types/server-api.types.js";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

function statusForPanelAppError(code: string): 400 | 404 {
  return code === "PANEL_APP_NOT_FOUND" ||
    code === "PANEL_APP_BRIDGE_SESSION_NOT_FOUND"
    ? 404
    : 400;
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

  readonly getPanelAppBridgeScript = (): Response => {
    return new Response(this.panelAppManager.getPanelAppBridgeScript(), {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  };

  readonly createBridgeSession = async (c: Context) => {
    const body = await readJson<PanelAppBridgeSessionCreateRequest>(c.req.raw);
    if (
      !body.ok ||
      !isRecord(body.data) ||
      typeof body.data.panelAppId !== "string" ||
      typeof body.data.tabId !== "string"
    ) {
      return c.json(err("INVALID_PANEL_APP_BRIDGE_SESSION", "invalid bridge session request"), 400);
    }
    try {
      const session = await this.panelAppManager.createPanelAppBridgeSession({
        id: body.data.panelAppId,
        tabId: body.data.tabId,
      });
      return c.json(ok({
        id: session.id,
        token: session.token,
        panelAppId: session.panelAppId,
        tabId: session.tabId,
        expiresAt: session.expiresAt,
      }));
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

  readonly deleteBridgeSession = (c: Context) => {
    this.panelAppManager.deletePanelAppBridgeSession(c.req.param("token"));
    return c.json(ok({ deleted: true }));
  };
}
