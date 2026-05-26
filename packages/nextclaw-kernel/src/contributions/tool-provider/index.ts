import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { ToolProvider as KernelToolProviderContract } from "@kernel/managers/tool.manager.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { AssetToolProvider } from "./providers/asset-tool.provider.js";
import { CoreToolProvider } from "./providers/core-tool.provider.js";
import { ExtensionToolProvider } from "./providers/extension-tool.provider.js";
import { KernelToolProvider } from "./providers/kernel-tool.provider.js";
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

    for (const provider of this.createKernelToolProviders()) {
      this.cleanups.push(this.kernel.toolManager.provideTools(provider).dispose);
    }

    this.cleanups.push(
      this.branch.toolProviderManager.register(new KernelToolProvider(this.kernel, this.branch)),
    );
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };

  private createKernelToolProviders = (): KernelToolProviderContract[] => [
    new CoreToolProvider(this.kernel),
    new MessagingToolProvider(this.kernel),
    new SessionToolProvider(this.kernel),
    new ExtensionToolProvider(this.kernel),
    new AssetToolProvider(this.kernel),
    new McpToolProvider(this.kernel),
  ];
}
