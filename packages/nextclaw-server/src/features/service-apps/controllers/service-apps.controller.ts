import type { Context } from "hono";
import {
  isPanelAppError,
  isServiceAppError,
  type PanelAppManager,
  type ServiceAppManager,
} from "@nextclaw/kernel";
import {
  err,
  isRecord,
  ok,
  readJson,
} from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { ServiceActionInvokeRequestView } from "@nextclaw-server/shared/types/server-api.types.js";

const PANEL_BRIDGE_SESSION_HEADER = "x-nextclaw-panel-bridge-session";

function statusForServiceAppError(code: string): 400 | 401 | 403 | 404 {
  switch (code) {
    case "AUTHORIZATION_REQUIRED":
      return 401;
    case "SERVICE_APP_ACTION_NOT_DECLARED":
      return 403;
    case "SERVICE_APP_ACTION_NOT_FOUND":
    case "SERVICE_APP_NOT_FOUND":
      return 404;
    default:
      return 400;
  }
}

export class ServiceAppsRoutesController {
  constructor(private readonly params: {
    panelAppManager: PanelAppManager;
    serviceAppManager: ServiceAppManager;
  }) {}

  readonly listServiceApps = async (c: Context) => {
    return c.json(ok(await this.params.serviceAppManager.listServiceApps()));
  };

  readonly getServiceApp = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.getServiceApp(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listServiceActions = async (c: Context) => {
    try {
      const bridgeSession = this.readOptionalBridgeSession(c);
      const appId = c.req.query("appId")?.trim();
      const actions = await this.params.serviceAppManager.listServiceActions(
        bridgeSession
          ? {
              caller: bridgeSession.caller,
              appId,
              declaredActions: bridgeSession.declaredActions,
            }
          : { appId },
      );
      return c.json(ok({ actions }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly discoverServiceAppActions = async (c: Context) => {
    try {
      const actions = await this.params.serviceAppManager.discoverServiceAppActions(
        c.req.param("appId"),
      );
      return c.json(ok({ actions }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly invokeServiceAction = async (c: Context) => {
    const body = await readJson<ServiceActionInvokeRequestView>(c.req.raw);
    if (!body.ok || (body.data !== undefined && !isRecord(body.data))) {
      return c.json(err("INVALID_SERVICE_ACTION_REQUEST", "invalid service action request"), 400);
    }
    try {
      const bridgeSession = this.requireBridgeSession(c);
      const payload = await this.params.serviceAppManager.invokeServiceAction(
        c.req.param("actionId"),
        {
          caller: bridgeSession.caller,
          declaredActions: bridgeSession.declaredActions,
          input: isRecord(body.data.input) ? body.data.input : {},
        },
      );
      return c.json(ok(payload));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly grantServiceAction = async (c: Context) => {
    try {
      const bridgeSession = this.requireBridgeSession(c);
      const payload = await this.params.serviceAppManager.grantServiceAction(
        c.req.param("actionId"),
        {
          caller: bridgeSession.caller,
          declaredActions: bridgeSession.declaredActions,
        },
      );
      return c.json(ok(payload));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly listServiceActionGrants = async (c: Context) => {
    return c.json(ok({
      grants: await this.params.serviceAppManager.listServiceActionGrants(),
    }));
  };

  readonly revokeServiceAction = async (c: Context) => {
    try {
      const bridgeSession = this.requireBridgeSession(c);
      await this.params.serviceAppManager.revokeServiceAction(
        bridgeSession.caller,
        c.req.param("actionId"),
      );
      return c.json(ok({ revoked: true }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly revokeServiceActionGrant = async (c: Context) => {
    const caller = this.readCallerQuery(c);
    if (!caller) {
      return c.json(err("INVALID_SERVICE_ACTION_CALLER", "invalid service action caller"), 400);
    }
    try {
      await this.params.serviceAppManager.revokeServiceAction(
        caller,
        c.req.param("actionId"),
      );
      return c.json(ok({ revoked: true }));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly restartServiceApp = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.restartServiceApp(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  readonly deleteServiceApp = async (c: Context) => {
    try {
      return c.json(ok(await this.params.serviceAppManager.deleteServiceApp(c.req.param("appId"))));
    } catch (error) {
      return this.handleServiceAppError(c, error);
    }
  };

  private requireBridgeSession = (c: Context) => {
    const token = c.req.raw.headers.get(PANEL_BRIDGE_SESSION_HEADER)?.trim();
    if (!token) {
      throw new Error("panel app bridge session is required");
    }
    return this.params.panelAppManager.resolvePanelAppBridgeSession(token);
  };

  private readOptionalBridgeSession = (c: Context) => {
    const token = c.req.raw.headers.get(PANEL_BRIDGE_SESSION_HEADER)?.trim();
    return token
      ? this.params.panelAppManager.resolvePanelAppBridgeSession(token)
      : null;
  };

  private readCallerQuery = (c: Context) => {
    const surface = c.req.query("surface");
    const appId = c.req.query("appId")?.trim();
    if (surface !== "panel-app" || !appId) {
      return null;
    }
    return { surface, appId } as const;
  };

  private handleServiceAppError = (c: Context, error: unknown) => {
    if (isServiceAppError(error)) {
      return c.json(
        err(error.code, error.message),
        statusForServiceAppError(error.code),
      );
    }
    if (isPanelAppError(error)) {
      return c.json(err(error.code, error.message), 404);
    }
    if (error instanceof Error && error.message === "panel app bridge session is required") {
      return c.json(err("PANEL_APP_BRIDGE_SESSION_REQUIRED", error.message), 401);
    }
    throw error;
  };
}
