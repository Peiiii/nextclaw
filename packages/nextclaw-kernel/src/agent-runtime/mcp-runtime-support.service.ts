import type { Config } from "@nextclaw/core";
import { McpRegistryService, McpServerLifecycleManager, type McpServerWarmResult } from "@nextclaw/mcp";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";

export type McpRuntimeSupport = {
  toolRegistryAdapter: McpNcpToolRegistryAdapter;
  applyMcpConfig: (config: Config) => Promise<void>;
  prewarmEnabledServers: () => Promise<McpServerWarmResult[]>;
  dispose: () => Promise<void>;
};

export class McpRuntimeSupportOwner implements McpRuntimeSupport {
  private currentMcpConfig: Config;
  private readonly mcpLifecycleManager: McpServerLifecycleManager;
  private readonly mcpRegistryService: McpRegistryService;
  readonly toolRegistryAdapter: McpNcpToolRegistryAdapter;

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

  applyMcpConfig = async (config: Config): Promise<void> => {
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

  prewarmEnabledServers = async (): Promise<McpServerWarmResult[]> =>
    await this.mcpRegistryService.prewarmEnabledServers();

  dispose = async (): Promise<void> => {
    await this.mcpRegistryService.close();
  };
}
