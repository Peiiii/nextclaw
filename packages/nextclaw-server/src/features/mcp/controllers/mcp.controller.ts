import { McpServerDefinitionSchema, loadConfig, saveConfig } from "@nextclaw/core";
import { McpMutationService, McpRegistryService, normalizeMcpServerName } from "@nextclaw/mcp";
import type { Context } from "hono";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import type {
  McpConnectionCreateResult,
  McpConnectionRequest,
  McpConnectionTestResult,
} from "@nextclaw-server/shared/types/server-api.types.js";
import { emitConfigUpdated } from "@nextclaw-server/shared/utils/app-events.utils.js";
import { err, ok, readJson } from "@nextclaw-server/shared/utils/http-response.utils.js";

export class McpRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly testConnection = async (c: Context) => {
    const parsed = await this.readConnectionRequest(c);
    if (!parsed.ok) {
      return parsed.response;
    }

    const config = structuredClone(loadConfig(this.options.configPath));
    const mutation = new McpMutationService({
      getConfig: () => config,
      saveConfig: () => undefined,
    });
    const result = mutation.addServer(parsed.value.name, parsed.value.definition);
    if (!result.changed) {
      return c.json(err("MCP_CONNECTION_INVALID", result.message), 400);
    }

    const registry = new McpRegistryService({ getConfig: () => config });
    try {
      const warm = await registry.warmServer(result.name);
      return c.json(ok({
        name: warm.name,
        transport: parsed.value.definition.transport.type,
        accessible: warm.ok,
        toolCount: warm.toolCount,
        ...(warm.error ? { error: warm.error } : {}),
      } satisfies McpConnectionTestResult));
    } finally {
      await registry.close();
    }
  };

  readonly createConnection = async (c: Context) => {
    const parsed = await this.readConnectionRequest(c);
    if (!parsed.ok) {
      return parsed.response;
    }

    const mutation = new McpMutationService({
      getConfig: () => loadConfig(this.options.configPath),
      saveConfig: (config) => saveConfig(config, this.options.configPath),
    });
    const result = mutation.addServer(parsed.value.name, parsed.value.definition);
    if (!result.changed || !result.definition) {
      return c.json(err("MCP_CONNECTION_INVALID", result.message), 400);
    }

    emitConfigUpdated(this.options, "mcp");
    await this.options.applyLiveConfigReload?.();
    return c.json(ok({
      name: result.name,
      transport: result.definition.transport.type,
      message: result.message,
    } satisfies McpConnectionCreateResult));
  };

  private readonly readConnectionRequest = async (c: Context): Promise<
    | { ok: true; value: McpConnectionRequest }
    | { ok: false; response: Response }
  > => {
    const body = await readJson<Partial<McpConnectionRequest>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return { ok: false, response: c.json(err("INVALID_BODY", "invalid json body"), 400) };
    }

    try {
      const name = normalizeMcpServerName(body.data.name ?? "");
      const definition = McpServerDefinitionSchema.parse(body.data.definition);
      return {
        ok: true,
        value: {
          name,
          definition: {
            ...definition,
            metadata: {
              ...definition.metadata,
              source: "manual",
              installedAt: new Date().toISOString(),
            },
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        response: c.json(err("MCP_CONNECTION_INVALID", error instanceof Error ? error.message : String(error)), 400),
      };
    }
  };
}
