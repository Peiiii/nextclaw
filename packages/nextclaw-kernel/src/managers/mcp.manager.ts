import type { Config, McpServerDefinition } from "@nextclaw/core";
import {
  McpRegistryService,
  McpServerLifecycleManager,
  normalizeMcpServerName,
  type McpCatalogFilter,
} from "@nextclaw/mcp";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import type { NcpTool } from "@nextclaw/ncp";

export class McpManager {
  private baseConfig: Config;
  private currentMcpConfig: Config;
  private readonly contributedServers = new Map<string, McpServerDefinition>();
  private readonly mcpLifecycleManager: McpServerLifecycleManager;
  private readonly mcpRegistryService: McpRegistryService;
  private readonly toolRegistryAdapter: McpNcpToolRegistryAdapter;
  private warmupPromise: Promise<void> | null = null;

  constructor(getConfig: () => Config) {
    this.baseConfig = getConfig();
    this.currentMcpConfig = this.buildEffectiveConfig();
    this.mcpLifecycleManager = new McpServerLifecycleManager({
      getConfig: () => this.currentMcpConfig,
    });
    this.mcpRegistryService = new McpRegistryService({
      getConfig: () => this.currentMcpConfig,
      lifecycleManager: this.mcpLifecycleManager,
    });
    this.toolRegistryAdapter = new McpNcpToolRegistryAdapter(this.mcpRegistryService);
  }

  listToolsForRun = (params: { agentId: string }): ReadonlyArray<NcpTool> =>
    this.toolRegistryAdapter.listToolsForRun(params);

  registerServer = async (
    name: string,
    definition: McpServerDefinition,
  ): Promise<() => Promise<void>> => {
    const normalizedName = normalizeMcpServerName(name);
    if (
      this.baseConfig.mcp.servers[normalizedName] ||
      this.contributedServers.has(normalizedName)
    ) {
      throw new Error(`MCP server is already registered: ${normalizedName}`);
    }
    const previousConfig = this.currentMcpConfig;
    const registeredDefinition = structuredClone(definition);
    this.contributedServers.set(normalizedName, registeredDefinition);
    const nextConfig = this.buildEffectiveConfig();
    this.currentMcpConfig = nextConfig;
    try {
      await this.mcpRegistryService.reconcileConfig({
        prevConfig: previousConfig,
        nextConfig,
      });
    } catch (error) {
      this.contributedServers.delete(normalizedName);
      this.currentMcpConfig = previousConfig;
      throw error;
    }
    return async () => {
      if (this.contributedServers.get(normalizedName) !== registeredDefinition) {
        return;
      }
      const currentConfig = this.currentMcpConfig;
      this.contributedServers.delete(normalizedName);
      const restoredConfig = this.buildEffectiveConfig();
      this.currentMcpConfig = restoredConfig;
      await this.mcpRegistryService.reconcileConfig({
        prevConfig: currentConfig,
        nextConfig: restoredConfig,
      });
    };
  };

  listServers = () => this.mcpRegistryService.listServers();

  listTools = (filter: McpCatalogFilter = {}) =>
    this.mcpRegistryService.listAccessibleTools(filter);

  callTool = (params: Parameters<McpRegistryService["callTool"]>[0]) =>
    this.mcpRegistryService.callTool(params);

  start = (): void => {
    this.warmupPromise ??= this.prewarmEnabledServersSafely();
  };

  applyConfig = async (config: Config): Promise<void> => {
    for (const name of this.contributedServers.keys()) {
      if (config.mcp.servers[name]) {
        throw new Error(`MCP server is already registered: ${name}`);
      }
    }
    const previousConfig = this.currentMcpConfig;
    this.baseConfig = config;
    this.currentMcpConfig = this.buildEffectiveConfig();
    const reconcileResult = await this.mcpRegistryService.reconcileConfig({
      prevConfig: previousConfig,
      nextConfig: this.currentMcpConfig,
    });

    for (const warmResult of reconcileResult.warmed) {
      if (!warmResult.ok) {
        console.warn(`[mcp] Failed to warm ${warmResult.name}: ${warmResult.error}`);
      }
    }
  };

  dispose = async (): Promise<void> => {
    await this.warmupPromise?.catch(() => undefined);
    await this.mcpRegistryService.close();
  };

  private buildEffectiveConfig = (): Config => ({
    ...this.baseConfig,
    mcp: {
      ...this.baseConfig.mcp,
      servers: {
        ...this.baseConfig.mcp.servers,
        ...Object.fromEntries(this.contributedServers),
      },
    },
  });

  private prewarmEnabledServersSafely = async (): Promise<void> => {
    const results = await this.mcpRegistryService.prewarmEnabledServers();
    for (const result of results) {
      if (!result.ok) {
        console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
      }
    }
  };
}
