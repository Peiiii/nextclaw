import { Tool } from "./base.js";

export type GatewayConfigSnapshot = {
  raw?: string | null;
  hash?: string | null;
  path?: string;
  config?: Record<string, unknown>;
  parsed?: Record<string, unknown>;
  resolved?: Record<string, unknown>;
  valid?: boolean;
};

export type GatewayController = {
  status?: () => Promise<Record<string, unknown> | string> | Record<string, unknown> | string;
  reloadConfig?: (reason?: string) => Promise<string | void> | string | void;
  restart?: (options?: { delayMs?: number; reason?: string; sessionKey?: string }) => Promise<string | void> | string | void;
  getConfig?: () => Promise<GatewayConfigSnapshot | string> | GatewayConfigSnapshot | string;
  getConfigSchema?: () => Promise<Record<string, unknown> | string> | Record<string, unknown> | string;
  applyConfig?: (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }) => Promise<Record<string, unknown> | string | void> | Record<string, unknown> | string | void;
  patchConfig?: (params: {
    raw: string;
    baseHash?: string;
    note?: string;
    restartDelayMs?: number;
    sessionKey?: string;
  }) => Promise<Record<string, unknown> | string | void> | Record<string, unknown> | string | void;
  updateRun?: (params: {
    note?: string;
    restartDelayMs?: number;
    timeoutMs?: number;
    sessionKey?: string;
  }) => Promise<Record<string, unknown> | string | void> | Record<string, unknown> | string | void;
};

type GatewayToolContext = {
  sessionKey?: string;
};

export class GatewayTool extends Tool {
  private context: GatewayToolContext = {};

  constructor(private controller?: GatewayController) {
    super();
  }

  setContext = (context: GatewayToolContext): void => {
    this.context = {
      sessionKey: typeof context.sessionKey === "string" ? context.sessionKey.trim() || undefined : undefined
    };
  };

  get name(): string {
    return "gateway";
  }

  get description(): string {
    return "Inspect gateway config, apply config changes, and request an explicit restart when needed.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "restart",
            "config.get",
            "config.schema",
            "config.apply",
            "config.patch",
            "update.run"
          ],
          description: "Action to perform"
        },
        delayMs: { type: "number", description: "Restart delay (ms)" },
        reason: { type: "string", description: "Optional reason for the action" },
        gatewayUrl: { type: "string", description: "Optional gateway url (unused in local runtime)" },
        gatewayToken: { type: "string", description: "Optional gateway token (unused in local runtime)" },
        timeoutMs: { type: "number", description: "Optional timeout (ms)" },
        raw: { type: "string", description: "Raw config JSON string for apply/patch" },
        baseHash: { type: "string", description: "Config base hash (from config.get)" },
        sessionKey: { type: "string", description: "Session key for restart notification" },
        note: { type: "string", description: "Completion note for config apply/patch" },
        restartDelayMs: {
          type: "number",
          description: "Deprecated for config.apply/config.patch; config writes no longer auto-restart."
        }
      },
      required: ["action"]
    };
  }

  private renderResult = (result: Record<string, unknown>): string => {
    return JSON.stringify(result, null, 2);
  };

  private resolveSessionKey = (params: Record<string, unknown>): string | undefined => {
    if (typeof params.sessionKey === "string" && params.sessionKey.trim()) {
      return params.sessionKey.trim();
    }
    return this.context.sessionKey;
  };

  private resolveBaseHash = async (params: Record<string, unknown>): Promise<string | undefined> => {
    const explicitHash =
      typeof params.baseHash === "string" && params.baseHash.trim() ? params.baseHash.trim() : undefined;
    if (explicitHash || !this.controller?.getConfig) {
      return explicitHash;
    }
    const snapshot = await this.controller.getConfig();
    if (!snapshot || typeof snapshot !== "object") {
      return undefined;
    }
    const hashValue = (snapshot as GatewayConfigSnapshot).hash;
    return typeof hashValue === "string" && hashValue.trim() ? hashValue.trim() : undefined;
  };

  private executeConfigRead = async (action: "config.get" | "config.schema"): Promise<string> => {
    if (action === "config.get") {
      if (!this.controller?.getConfig) {
        return this.renderResult({ ok: false, error: "config.get not supported" });
      }
      const result = await this.controller.getConfig();
      return this.renderResult({ ok: true, result });
    }
    if (!this.controller?.getConfigSchema) {
      return this.renderResult({ ok: false, error: "config.schema not supported" });
    }
    const result = await this.controller.getConfigSchema();
    return this.renderResult({ ok: true, result });
  };

  private executeConfigWrite = async (
    action: "config.apply" | "config.patch",
    params: Record<string, unknown>
  ): Promise<string> => {
    const raw = params.raw;
    if (typeof raw !== "string" || !raw.trim()) {
      return this.renderResult({ ok: false, error: "raw config string is required" });
    }

    const note = typeof params.note === "string" ? params.note.trim() || undefined : undefined;
    const baseHash = await this.resolveBaseHash(params);
    const sessionKey = this.resolveSessionKey(params);

    if (action === "config.apply") {
      if (!this.controller?.applyConfig) {
        return this.renderResult({ ok: false, error: "config.apply not supported" });
      }
      const result = await this.controller.applyConfig({
        raw,
        baseHash,
        note,
        sessionKey
      });
      return this.renderResult({ ok: true, result });
    }

    if (!this.controller?.patchConfig) {
      return this.renderResult({ ok: false, error: "config.patch not supported" });
    }
    const result = await this.controller.patchConfig({
      raw,
      baseHash,
      note,
      sessionKey
    });
    return this.renderResult({ ok: true, result });
  };

  private executeRestart = async (params: Record<string, unknown>): Promise<string> => {
    if (!this.controller?.restart) {
      return this.renderResult({ ok: false, error: "restart not supported" });
    }
    const delayMs =
      typeof params.delayMs === "number" && Number.isFinite(params.delayMs)
        ? Math.floor(params.delayMs)
        : undefined;
    const reason = typeof params.reason === "string" ? params.reason.trim() || undefined : undefined;
    const sessionKey = this.resolveSessionKey(params);
    const result = await this.controller.restart({ delayMs, reason, sessionKey });
    return this.renderResult({ ok: true, result: result ?? "Restart scheduled" });
  };

  private executeUpdateRun = async (params: Record<string, unknown>): Promise<string> => {
    if (!this.controller?.updateRun) {
      return this.renderResult({ ok: false, error: "update.run not supported in this runtime" });
    }
    const restartDelayMs =
      typeof params.restartDelayMs === "number" && Number.isFinite(params.restartDelayMs)
        ? Math.floor(params.restartDelayMs)
        : undefined;
    const timeoutMs =
      typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
        ? Math.max(1, Math.floor(params.timeoutMs))
        : undefined;
    const note = typeof params.note === "string" ? params.note.trim() || undefined : undefined;
    const sessionKey = this.resolveSessionKey(params);
    const result = await this.controller.updateRun({ note, restartDelayMs, timeoutMs, sessionKey });
    return this.renderResult({ ok: true, result });
  };

  execute = async (params: Record<string, unknown>): Promise<string> => {
    const action = String(params.action ?? "");
    if (!this.controller) {
      return this.renderResult({ ok: false, error: "gateway controller not available in this runtime" });
    }
    if (action === "config.get" || action === "config.schema") {
      return this.executeConfigRead(action);
    }
    if (action === "config.apply" || action === "config.patch") {
      return this.executeConfigWrite(action, params);
    }
    if (action === "restart") {
      return this.executeRestart(params);
    }
    if (action === "update.run") {
      return this.executeUpdateRun(params);
    }
    return this.renderResult({ ok: false, error: `Unknown action: ${action}` });
  };
}
