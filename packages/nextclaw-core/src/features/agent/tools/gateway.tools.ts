import { Tool, normalizeToolParams } from "./base.tools.js";

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
  getConfig?: () => Promise<GatewayConfigSnapshot | string> | GatewayConfigSnapshot | string;
  getConfigSchema?: () => Promise<Record<string, unknown> | string> | Record<string, unknown> | string;
  applyConfig?: (params: {
    raw: string;
    baseHash?: string;
    note?: string;
  }) => Promise<Record<string, unknown> | string | void> | Record<string, unknown> | string | void;
  patchConfig?: (params: {
    raw: string;
    baseHash?: string;
    note?: string;
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
    return "Inspect and apply gateway config changes, or run an explicitly requested runtime update.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "config.get",
            "config.schema",
            "config.apply",
            "config.patch",
            "update.run"
          ],
          description: "Action to perform"
        },
        timeoutMs: { type: "number", description: "Optional timeout (ms)" },
        raw: { type: "string", description: "Raw config JSON string for apply/patch" },
        baseHash: { type: "string", description: "Config base hash (from config.get)" },
        sessionKey: { type: "string", description: "Session key for update completion notification" },
        note: { type: "string", description: "Optional completion note" },
        restartDelayMs: {
          type: "number",
          description: "Delay before the update relaunch (ms)"
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
    if (action === "config.apply") {
      if (!this.controller?.applyConfig) {
        return this.renderResult({ ok: false, error: "config.apply not supported" });
      }
      const result = await this.controller.applyConfig({
        raw,
        baseHash,
        note
      });
      return this.renderResult({ ok: true, result });
    }

    if (!this.controller?.patchConfig) {
      return this.renderResult({ ok: false, error: "config.patch not supported" });
    }
    const result = await this.controller.patchConfig({
      raw,
      baseHash,
      note
    });
    return this.renderResult({ ok: true, result });
  };

  private executeUpdateRun = async (params: Record<string, unknown>): Promise<string> => {
    if (!this.controller?.updateRun) {
      return this.renderResult({ ok: false, error: "update.run not supported in this runtime" });
    }
    const {
      note: rawNote,
      restartDelayMs: rawRestartDelayMs,
      timeoutMs: rawTimeoutMs,
    } = params;
    const restartDelayMs =
      typeof rawRestartDelayMs === "number" && Number.isFinite(rawRestartDelayMs)
        ? Math.floor(rawRestartDelayMs)
        : undefined;
    const timeoutMs =
      typeof rawTimeoutMs === "number" && Number.isFinite(rawTimeoutMs)
        ? Math.max(1, Math.floor(rawTimeoutMs))
        : undefined;
    const note = typeof rawNote === "string" ? rawNote.trim() || undefined : undefined;
    const sessionKey = this.resolveSessionKey(params);
    const result = await this.controller.updateRun({ note, restartDelayMs, timeoutMs, sessionKey });
    return this.renderResult({ ok: true, result });
  };

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
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
    if (action === "update.run") {
      return this.executeUpdateRun(params);
    }
    return this.renderResult({ ok: false, error: `Unknown action: ${action}` });
  };
}
