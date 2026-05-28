import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { AssetToolProvider } from "./providers/asset-tool.provider.js";
import { CoreToolProvider } from "./providers/core-tool.provider.js";
import { McpToolProvider } from "./providers/mcp-tool.provider.js";
import { MessagingToolProvider } from "./providers/messaging-tool.provider.js";
import { SessionToolProvider } from "./providers/session-tool.provider.js";
import { StructuredResultToolProvider } from "./providers/structured-result-tool.provider.js";

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

  private createToolProviders = (): ToolProvider[] => [
    new StructuredResultToolProvider(),
    new CoreToolProvider(this.kernel),
    new MessagingToolProvider(this.kernel),
    new SessionToolProvider(this.kernel),
    new AssetToolProvider(this.kernel),
    new McpToolProvider(this.kernel),
  ];
}
