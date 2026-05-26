import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { ToolProvider } from "@kernel/features/agent-run/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { AssetToolProvider } from "./providers/asset-tool.provider.js";
import { CoreToolProvider } from "./providers/core-tool.provider.js";
import { McpToolProvider } from "./providers/mcp-tool.provider.js";
import { MessagingToolProvider } from "./providers/messaging-tool.provider.js";
import { SessionToolProvider } from "./providers/session-tool.provider.js";

export class ToolProviderContribution implements KernelContribution {
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }

    for (const provider of this.createToolProviders()) {
      this.cleanups.push(this.branch.toolProviderManager.register(provider));
    }
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };

  private createToolProviders = (): ToolProvider[] => [
    new CoreToolProvider(this.kernel, this.branch),
    new MessagingToolProvider(this.kernel, this.branch),
    new SessionToolProvider(this.kernel, this.branch),
    new AssetToolProvider(this.kernel),
    new McpToolProvider(this.kernel, this.branch),
  ];
}
