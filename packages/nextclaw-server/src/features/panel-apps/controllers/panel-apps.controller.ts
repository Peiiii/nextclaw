import type { Context } from "hono";
import {
  isPanelAppError,
  PanelAppError,
  type PanelAppAgentCapability,
  type PanelAppManager,
} from "@nextclaw/kernel";
import type {
  PanelAppAgentGenerateObjectRequestView,
  PanelAppAgentSendRequestView,
  PanelAppBridgeSessionCreateRequest,
} from "@nextclaw-server/shared/types/server-api.types.js";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

function statusForPanelAppError(code: string): 400 | 401 | 403 | 404 | 408 {
  switch (code) {
    case "AUTHORIZATION_REQUIRED":
      return 401;
    case "PANEL_APP_CAPABILITY_NOT_DECLARED":
    case "PANEL_APP_CLIENT_NOT_DECLARED":
      return 403;
    case "PANEL_APP_NOT_FOUND":
    case "PANEL_APP_BRIDGE_SESSION_NOT_FOUND":
      return 404;
    case "PANEL_APP_ASSET_TOKEN_EXPIRED":
    case "PANEL_APP_ASSET_TOKEN_INVALID":
      return 401;
    case "PANEL_APP_INVALID_ASSET_PATH":
    case "PANEL_APP_MANIFEST_INVALID":
      return 400;
    case "AGENT_OBJECT_RESULT_TIMEOUT":
      return 408;
    default:
      return 400;
  }
}

export class PanelAppsRoutesController {
  constructor(
    private readonly panelAppManager: PanelAppManager,
    private readonly params: {
      panelAppClientSdkScript?: () => Promise<string> | string;
    } = {},
  ) {}

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

  readonly deletePanelApp = async (c: Context) => {
    try {
      const payload = await this.panelAppManager.deletePanelApp(c.req.param("id"));
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

  readonly getPanelAppAsset = async (c: Context): Promise<Response> => {
    try {
      const payload = await this.panelAppManager.getPanelAppAsset(
        c.req.param("id"),
        readAssetPath(c.req.raw.url),
      );
      return new Response(payload.content, {
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

  readonly getPanelAppAssetByToken = async (c: Context): Promise<Response> => {
    try {
      const payload = await this.panelAppManager.getPanelAppAssetByToken(
        c.req.param("token"),
        readTokenizedAssetPath(c.req.raw.url, c.req.param("token")),
      );
      return new Response(payload.content, {
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

  readonly getPanelAppClientSdkScript = async (): Promise<Response> => {
    if (!this.params.panelAppClientSdkScript) {
      return new Response("Panel App client SDK script is not configured.", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return new Response(await this.params.panelAppClientSdkScript(), {
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
      (typeof body.data.panelAppId !== "string" && typeof body.data.appId !== "string")
    ) {
      return c.json(err("INVALID_PANEL_APP_BRIDGE_SESSION", "invalid bridge session request"), 400);
    }
    const panelAppId = typeof body.data.appId === "string"
      ? body.data.appId
      : body.data.panelAppId;
    if (typeof panelAppId !== "string") {
      return c.json(err("INVALID_PANEL_APP_BRIDGE_SESSION", "invalid bridge session request"), 400);
    }
    try {
      const session = await this.panelAppManager.createPanelAppBridgeSession({
        id: panelAppId,
      });
      return c.json(ok({
        id: session.id,
        token: session.token,
        appId: session.appId,
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

  readonly grantClient = async (c: Context) => {
    try {
      return c.json(ok(await this.panelAppManager.grantPanelAppClient(
        c.req.param("appId"),
      )));
    } catch (error) {
      return this.handlePanelAppError(c, error);
    }
  };

  readonly revokeClient = async (c: Context) => {
    try {
      await this.panelAppManager.revokePanelAppClient(c.req.param("appId"));
      return c.json(ok({ revoked: true }));
    } catch (error) {
      return this.handlePanelAppError(c, error);
    }
  };

  readonly sendAgentMessage = async (c: Context) => {
    const body = await readJson<PanelAppAgentSendRequestView>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || !isRecord(body.data.payload)) {
      return c.json(err("INVALID_PANEL_APP_AGENT_REQUEST", "invalid agent send request"), 400);
    }
    try {
      return c.json(ok(await this.panelAppManager.sendAgentMessage(
        this.requireBridgeSessionToken(c),
        body.data.payload,
      )));
    } catch (error) {
      return this.handlePanelAppError(c, error);
    }
  };

  readonly generateAgentObject = async (c: Context) => {
    const body = await readJson<PanelAppAgentGenerateObjectRequestView>(c.req.raw);
    if (!body.ok || !isRecord(body.data) || !isRecord(body.data.input)) {
      return c.json(err("INVALID_PANEL_APP_AGENT_REQUEST", "invalid generateObject request"), 400);
    }
    try {
      return c.json(ok(await this.panelAppManager.generateAgentObject(
        this.requireBridgeSessionToken(c),
        body.data.input,
      )));
    } catch (error) {
      return this.handlePanelAppError(c, error);
    }
  };

  readonly grantAgentCapability = async (c: Context) => {
    try {
      return c.json(ok(await this.panelAppManager.grantAgentCapability(
        this.requireBridgeSessionToken(c),
        c.req.param("capability") as PanelAppAgentCapability,
      )));
    } catch (error) {
      return this.handlePanelAppError(c, error);
    }
  };

  private requireBridgeSessionToken = (c: Context): string => {
    const token = c.req.raw.headers.get(PANEL_BRIDGE_SESSION_HEADER)?.trim();
    if (!token) {
      throw new Error("panel app bridge session is required");
    }
    return token;
  };

  private handlePanelAppError = (c: Context, error: unknown) => {
    if (isPanelAppError(error)) {
      return c.json(
        err(error.code, error.message),
        statusForPanelAppError(error.code),
      );
    }
    if (error instanceof Error && error.message === "panel app bridge session is required") {
      return c.json(err("PANEL_APP_BRIDGE_SESSION_REQUIRED", error.message), 401);
    }
    throw error;
  };
}

function readAssetPath(url: string): string {
  const pathname = new URL(url).pathname;
  const marker = "/assets/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }
  try {
    return decodeURIComponent(pathname.slice(markerIndex + marker.length));
  } catch {
    throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
  }
}

function readTokenizedAssetPath(url: string, token: string): string {
  const pathname = new URL(url).pathname;
  const marker = `/api/panel-app-assets/${encodeURIComponent(token)}/`;
  if (!pathname.startsWith(marker)) {
    return "";
  }
  try {
    return decodeURIComponent(pathname.slice(marker.length));
  } catch {
    throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
  }
}
