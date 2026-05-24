import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { KernelContextProvider } from "./providers/kernel-context.provider.js";

export class ContextProviderContribution implements KernelContribution {
  private unregister: (() => void) | null = null;

  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  start = (): void => {
    if (this.unregister) {
      return;
    }
    this.unregister = this.branch.contextProviderManager.register(
      new KernelContextProvider(this.kernel, this.branch),
    );
  };

  dispose = (): void => {
    this.unregister?.();
    this.unregister = null;
  };
}
