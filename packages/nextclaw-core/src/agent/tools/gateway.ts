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
  restart?: (options?: { delayMs?: number; reason?: string }) => Promise<string | void> | string | void;
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

export class GatewayTool extends Tool {
  constructor(private controller?: GatewayController) {
    super();
  }

  get name(): string {
    return "gateway";
  }

  get description(): string {
    return "Restart or update gateway config (config.get/schema/apply/patch) and trigger restart.";
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
        restartDelayMs: { type: "number", description: "Restart delay after apply/patch (ms)" }
      },
      required: ["action"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const action = String(params.action ?? "");
    if (!this.controller) {
      return JSON.stringify({ ok: false, error: "gateway controller not available in this runtime" }, null, 2);
    }
    if (action === "config.get") {
      if (!this.controller.getConfig) {
        return JSON.stringify({ ok: false, error: "config.get not supported" }, null, 2);
      }
      const result = await this.controller.getConfig();
      return JSON.stringify({ ok: true, result }, null, 2);
    }
    if (action === "config.schema") {
      if (!this.controller.getConfigSchema) {
        return JSON.stringify({ ok: false, error: "config.schema not supported" }, null, 2);
      }
      const result = await this.controller.getConfigSchema();
      return JSON.stringify({ ok: true, result }, null, 2);
    }
    if (action === "config.apply" || action === "config.patch") {
      const raw = params.raw;
      if (typeof raw !== "string" || !raw.trim()) {
        return JSON.stringify({ ok: false, error: "raw config string is required" }, null, 2);
      }
      const note = typeof params.note === "string" ? params.note.trim() || undefined : undefined;
      const restartDelayMs =
        typeof params.restartDelayMs === "number" && Number.isFinite(params.restartDelayMs)
          ? Math.floor(params.restartDelayMs)
          : undefined;
      let baseHash =
        typeof params.baseHash === "string" && params.baseHash.trim() ? params.baseHash.trim() : undefined;
      if (!baseHash && this.controller.getConfig) {
        const snapshot = await this.controller.getConfig();
        if (snapshot && typeof snapshot === "object") {
          const hashValue = (snapshot as GatewayConfigSnapshot).hash;
          if (typeof hashValue === "string" && hashValue.trim()) {
            baseHash = hashValue.trim();
          }
        }
      }
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim() ? params.sessionKey.trim() : undefined;
      if (action === "config.apply") {
        if (!this.controller.applyConfig) {
          return JSON.stringify({ ok: false, error: "config.apply not supported" }, null, 2);
        }
        const result = await this.controller.applyConfig({
          raw,
          baseHash,
          note,
          restartDelayMs,
          sessionKey
        });
        return JSON.stringify({ ok: true, result }, null, 2);
      }
      if (!this.controller.patchConfig) {
        return JSON.stringify({ ok: false, error: "config.patch not supported" }, null, 2);
      }
      const result = await this.controller.patchConfig({
        raw,
        baseHash,
        note,
        restartDelayMs,
        sessionKey
      });
      return JSON.stringify({ ok: true, result }, null, 2);
    }
    if (action === "restart") {
      if (!this.controller.restart) {
        return JSON.stringify({ ok: false, error: "restart not supported" }, null, 2);
      }
      const delayMs =
        typeof params.delayMs === "number" && Number.isFinite(params.delayMs)
          ? Math.floor(params.delayMs)
          : undefined;
      const reason = typeof params.reason === "string" ? params.reason.trim() || undefined : undefined;
      const result = await this.controller.restart({ delayMs, reason });
      return JSON.stringify({ ok: true, result: result ?? "Restart scheduled" }, null, 2);
    }
    if (action === "update.run") {
      if (!this.controller.updateRun) {
        return JSON.stringify({ ok: false, error: "update.run not supported in this runtime" }, null, 2);
      }
      const restartDelayMs =
        typeof params.restartDelayMs === "number" && Number.isFinite(params.restartDelayMs)
          ? Math.floor(params.restartDelayMs)
          : undefined;
      const timeoutMs =
        typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
          ? Math.max(1, Math.floor(params.timeoutMs))
          : undefined;
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim() ? params.sessionKey.trim() : undefined;
      const note = typeof params.note === "string" ? params.note.trim() || undefined : undefined;
      const result = await this.controller.updateRun({ note, restartDelayMs, timeoutMs, sessionKey });
      return JSON.stringify({ ok: true, result }, null, 2);
    }
    return JSON.stringify({ ok: false, error: `Unknown action: ${action}` }, null, 2);
  }
}
