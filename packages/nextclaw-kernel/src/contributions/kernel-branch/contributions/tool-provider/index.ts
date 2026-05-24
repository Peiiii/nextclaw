import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { KernelToolProvider } from "./providers/kernel-tool.provider.js";

export class ToolProviderContribution implements KernelContribution {
  private unregister: (() => void) | null = null;

  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  start = (): void => {
    if (this.unregister) {
      return;
    }
    this.unregister = this.branch.toolProviderManager.register(
      new KernelToolProvider(this.kernel, this.branch),
    );
  };

  dispose = (): void => {
    this.unregister?.();
    this.unregister = null;
  };
}
