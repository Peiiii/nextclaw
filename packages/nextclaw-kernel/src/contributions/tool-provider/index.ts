import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import { Contribution } from "@nextclaw/shared";
import { AssetToolProvider } from "./providers/asset-tool.provider.js";
import { CoreToolProvider } from "./providers/core-tool.provider.js";
import { McpToolProvider } from "./providers/mcp-tool.provider.js";
import { MessagingToolProvider } from "./providers/messaging-tool.provider.js";
import { ProjectToolProvider } from "./providers/project-tool.provider.js";
import { SessionToolProvider } from "./providers/session-tool.provider.js";
import { ShowContentToolProvider } from "./providers/show-content-tool.provider.js";
import { InboxDeliveryToolProvider } from "./providers/inbox-delivery-tool.provider.js";
import { StructuredResultToolProvider } from "./providers/structured-result-tool.provider.js";
import { ToolProviderRunContextService } from "./services/tool-provider-run-context.service.js";

export { ShowContentToolProvider };

export class ToolProviderContribution extends Contribution {
  constructor(private readonly kernel: NextclawKernel) {
    super();
  }

  protected setup = (): void => {
    for (const provider of this.createToolProviders()) {
      this.effect(() => this.kernel.toolProviderManager.register(provider));
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
      new InboxDeliveryToolProvider(this.kernel.inboxDeliveryManager),
      new CoreToolProvider(runContextService, this.kernel.getGatewayController),
      new MessagingToolProvider(
        runContextService,
        this.kernel.channels,
        this.kernel.automation,
        this.kernel.extensions,
      ),
      new ProjectToolProvider(this.kernel.projectManager),
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
