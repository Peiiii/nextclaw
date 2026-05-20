import type { Config } from "@nextclaw/core";
import { McpRegistryService, McpServerLifecycleManager } from "@nextclaw/mcp";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import type { NcpTool } from "@nextclaw/ncp";

export class McpManager {
  private currentMcpConfig: Config;
  private readonly mcpLifecycleManager: McpServerLifecycleManager;
  private readonly mcpRegistryService: McpRegistryService;
  private readonly toolRegistryAdapter: McpNcpToolRegistryAdapter;
  private warmupPromise: Promise<void> | null = null;

  constructor(getConfig: () => Config) {
    this.currentMcpConfig = getConfig();
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

  start = (): void => {
    this.warmupPromise ??= this.prewarmEnabledServersSafely();
  };

  applyConfig = async (config: Config): Promise<void> => {
    const previousConfig = this.currentMcpConfig;
    this.currentMcpConfig = config;
    const reconcileResult = await this.mcpRegistryService.reconcileConfig({
      prevConfig: previousConfig,
      nextConfig: config,
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

  private prewarmEnabledServersSafely = async (): Promise<void> => {
    const results = await this.mcpRegistryService.prewarmEnabledServers();
    for (const result of results) {
      if (!result.ok) {
        console.warn(`[mcp] Failed to warm ${result.name}: ${result.error}`);
      }
    }
  };
}
