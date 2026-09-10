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
};

export class GatewayTool extends Tool {
  constructor(private controller?: GatewayController) {
    super();
  }

  get name(): string {
    return "gateway";
  }

  get description(): string {
    return "Read or update gateway config for documented gaps in object-level CLI or explicit recovery; prefer nextclaw providers/models/search/agents/mcp commands for covered management tasks.";
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
            "config.patch"
          ],
          description: "Action to perform"
        },
        raw: { type: "string", description: "Raw config JSON string for apply/patch" },
        baseHash: { type: "string", description: "Config base hash (from config.get)" },
        note: { type: "string", description: "Optional completion note" },
      },
      required: ["action"]
    };
  }

  private renderResult = (result: Record<string, unknown>): string => {
    return JSON.stringify(result, null, 2);
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
    return this.renderResult({ ok: false, error: `Unknown action: ${action}` });
  };
}
