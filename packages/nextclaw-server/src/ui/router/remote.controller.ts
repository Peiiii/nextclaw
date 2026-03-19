import type { Context } from "hono";
import type {
  RemoteLoginRequest,
  RemoteServiceAction,
  RemoteSettingsUpdateRequest
} from "../types.js";
import { err, formatUserFacingError, ok, readJson, readNonEmptyString } from "./response.js";
import type { UiRemoteAccessHost } from "./types.js";

const REMOTE_SERVICE_ACTIONS = new Set<RemoteServiceAction>(["start", "restart", "stop"]);

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export class RemoteRoutesController {
  constructor(private readonly host: UiRemoteAccessHost) {}

  readonly getStatus = async (c: Context) => {
    try {
      return c.json(ok(await this.host.getStatus()));
    } catch (error) {
      return c.json(err("REMOTE_STATUS_FAILED", formatUserFacingError(error)), 500);
    }
  };

  readonly getDoctor = async (c: Context) => {
    try {
      return c.json(ok(await this.host.runDoctor()));
    } catch (error) {
      return c.json(err("REMOTE_DOCTOR_FAILED", formatUserFacingError(error)), 500);
    }
  };

  readonly login = async (c: Context) => {
    const body = await readJson<RemoteLoginRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const email = readNonEmptyString(body.data.email);
    const password = readNonEmptyString(body.data.password);
    if (!email || !password) {
      return c.json(err("INVALID_BODY", "email and password are required"), 400);
    }

    try {
      return c.json(ok(await this.host.login({
        email,
        password,
        apiBase: readTrimmedString(body.data.apiBase),
        register: readBoolean(body.data.register)
      })));
    } catch (error) {
      return c.json(err("REMOTE_LOGIN_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly logout = async (c: Context) => {
    try {
      return c.json(ok(await this.host.logout()));
    } catch (error) {
      return c.json(err("REMOTE_LOGOUT_FAILED", formatUserFacingError(error)), 500);
    }
  };

  readonly updateSettings = async (c: Context) => {
    const body = await readJson<RemoteSettingsUpdateRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    try {
      return c.json(ok(await this.host.updateSettings({
        enabled: readBoolean(body.data.enabled),
        deviceName: readTrimmedString(body.data.deviceName),
        platformApiBase: readTrimmedString(body.data.platformApiBase)
      })));
    } catch (error) {
      return c.json(err("REMOTE_SETTINGS_FAILED", formatUserFacingError(error)), 400);
    }
  };

  readonly controlService = async (c: Context) => {
    const action = c.req.param("action");
    if (!REMOTE_SERVICE_ACTIONS.has(action as RemoteServiceAction)) {
      return c.json(err("INVALID_ACTION", "unsupported remote service action"), 400);
    }

    try {
      return c.json(ok(await this.host.controlService(action as RemoteServiceAction)));
    } catch (error) {
      return c.json(err("REMOTE_SERVICE_FAILED", formatUserFacingError(error)), 400);
    }
  };
}
