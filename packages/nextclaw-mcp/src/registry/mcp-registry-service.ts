import type { Config, McpServerDefinition } from "@nextclaw/core";
import { getMcpServer, listMcpServers } from "../config/mcp-config-normalizer.js";
import { McpServerLifecycleManager } from "../lifecycle/mcp-server-lifecycle-manager.js";
import {
  isServerAccessibleToAgent,
  type McpConfigReconcileResult,
  type McpCatalogFilter,
  type McpServerRecord,
  type McpServerWarmResult,
  type McpToolCatalogEntry
} from "../types.js";

export class McpRegistryService {
  private readonly lifecycleManager: McpServerLifecycleManager;

  constructor(
    private readonly options: {
      getConfig: () => Config;
      lifecycleManager?: McpServerLifecycleManager;
    }
  ) {
    this.lifecycleManager = this.options.lifecycleManager ?? new McpServerLifecycleManager({
      getConfig: this.options.getConfig
    });
  }

  listServers(): McpServerRecord[] {
    return listMcpServers(this.options.getConfig());
  }

  getServer(name: string): McpServerRecord | undefined {
    return getMcpServer(this.options.getConfig(), name);
  }

  async prewarmEnabledServers(): Promise<McpServerWarmResult[]> {
    const results = await Promise.all(
      this.listServers()
        .filter((record) => record.definition.enabled)
        .map(async (record) => {
          try {
            const state = await this.lifecycleManager.warmServer(record);
            return {
              name: record.name,
              ok: true,
              toolCount: state.tools.length
            } satisfies McpServerWarmResult;
          } catch (error) {
            return {
              name: record.name,
              ok: false,
              toolCount: 0,
              error: toErrorMessage(error)
            } satisfies McpServerWarmResult;
          }
        })
    );
    return results.sort((left, right) => left.name.localeCompare(right.name));
  }

  async warmServer(name: string): Promise<McpServerWarmResult> {
    const server = this.getServer(name);
    if (!server) {
      throw new Error(`Unknown MCP server: ${name}`);
    }

    try {
      const state = await this.lifecycleManager.warmServer(server);
      return {
        name: server.name,
        ok: true,
        toolCount: state.tools.length
      };
    } catch (error) {
      return {
        name: server.name,
        ok: false,
        toolCount: 0,
        error: toErrorMessage(error)
      };
    }
  }

  async reconcileConfig(params: {
    prevConfig: Config;
    nextConfig: Config;
  }): Promise<McpConfigReconcileResult> {
    const previousServers = new Map(listMcpServers(params.prevConfig).map((record) => [record.name, record]));
    const nextServers = new Map(listMcpServers(params.nextConfig).map((record) => [record.name, record]));
    const serverNames = Array.from(new Set([...previousServers.keys(), ...nextServers.keys()])).sort((left, right) =>
      left.localeCompare(right)
    );

    const result: McpConfigReconcileResult = {
      added: [],
      removed: [],
      enabled: [],
      disabled: [],
      restarted: [],
      warmed: []
    };

    for (const serverName of serverNames) {
      const previous = previousServers.get(serverName);
      const next = nextServers.get(serverName);

      if (!next) {
        await this.lifecycleManager.closeServer(serverName);
        result.removed.push(serverName);
        continue;
      }

      if (!previous) {
        result.added.push(serverName);
        if (next.definition.enabled) {
          result.warmed.push(await this.warmRecord(next));
        }
        continue;
      }

      if (previous.definition.enabled && !next.definition.enabled) {
        await this.lifecycleManager.closeServer(serverName);
        result.disabled.push(serverName);
        continue;
      }

      if (!previous.definition.enabled && next.definition.enabled) {
        result.enabled.push(serverName);
        result.warmed.push(await this.warmRecord(next));
        continue;
      }

      if (hasReconnectRelevantChange(previous.definition, next.definition)) {
        await this.lifecycleManager.closeServer(serverName);
        result.restarted.push(serverName);
        if (next.definition.enabled) {
          result.warmed.push(await this.warmRecord(next));
        }
      }
    }

    return result;
  }

  listAccessibleTools(filter: McpCatalogFilter = {}): McpToolCatalogEntry[] {
    const config = this.options.getConfig();
    return this.listServers()
      .filter((record) => record.definition.enabled)
      .filter((record) =>
        isServerAccessibleToAgent({
          config,
          scope: record.definition.scope,
          agentId: filter.agentId
        })
      )
      .flatMap((record) => this.lifecycleManager.getCachedCatalog(record.name))
      .sort((left, right) => left.qualifiedName.localeCompare(right.qualifiedName));
  }

  getCachedState(serverName: string) {
    return this.lifecycleManager.getCachedState(serverName);
  }

  async callTool(params: {
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<unknown> {
    const server = this.getServer(params.serverName);
    if (!server) {
      throw new Error(`Unknown MCP server: ${params.serverName}`);
    }
    return this.lifecycleManager.callTool(server, params.toolName, params.args, {
      signal: params.signal,
    });
  }

  async close(): Promise<void> {
    await this.lifecycleManager.closeAll();
  }

  private async warmRecord(record: McpServerRecord): Promise<McpServerWarmResult> {
    try {
      const state = await this.lifecycleManager.warmServer(record);
      return {
        name: record.name,
        ok: true,
        toolCount: state.tools.length
      };
    } catch (error) {
      return {
        name: record.name,
        ok: false,
        toolCount: 0,
        error: toErrorMessage(error)
      };
    }
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasReconnectRelevantChange(left: McpServerDefinition, right: McpServerDefinition): boolean {
  return JSON.stringify(left.transport) !== JSON.stringify(right.transport);
}
