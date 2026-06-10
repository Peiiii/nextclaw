import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { AssetToolProvider } from "./providers/asset-tool.provider.js";
import { CoreToolProvider } from "./providers/core-tool.provider.js";
import { McpToolProvider } from "./providers/mcp-tool.provider.js";
import { MessagingToolProvider } from "./providers/messaging-tool.provider.js";
import { SessionToolProvider } from "./providers/session-tool.provider.js";
import { ShowContentToolProvider } from "./providers/show-content-tool.provider.js";
import { StructuredResultToolProvider } from "./providers/structured-result-tool.provider.js";
import { ToolProviderRunContextService } from "./services/tool-provider-run-context.service.js";

export class ToolProviderContribution implements KernelContribution {
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }

    for (const provider of this.createToolProviders()) {
      this.cleanups.push(this.kernel.toolProviderManager.register(provider));
    }
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };

  private createToolProviders = (): ToolProvider[] => {
    const runContextService = new ToolProviderRunContextService(
      this.kernel.sessionManager,
      this.kernel.agents,
      this.kernel.configManager,
    );
    return [
      new StructuredResultToolProvider(),
      new ShowContentToolProvider(this.kernel.eventBus),
      new CoreToolProvider(runContextService, this.kernel.getGatewayController),
      new MessagingToolProvider(
        runContextService,
        this.kernel.channels,
        this.kernel.automation,
        this.kernel.extensions,
      ),
      new SessionToolProvider(
        runContextService,
        this.kernel.sessionManager,
        this.kernel.sessionRequests,
        this.kernel.sessionSearch,
      ),
      new AssetToolProvider(this.kernel.assetStore),
      new McpToolProvider(runContextService, this.kernel.mcpManager),
    ];
  };
}
