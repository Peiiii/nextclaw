import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { KernelContextProvider } from "./providers/kernel-context.provider.js";
import { ReplyFormatContextProvider } from "./providers/reply-format-context.provider.js";

export { ReplyFormatContextProvider } from "./providers/reply-format-context.provider.js";

export class ContextProviderContribution implements KernelContribution {
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly kernel: NextclawKernel) {}

  start = (): void => {
    if (this.cleanups.length > 0) {
      return;
    }

    for (const provider of [
      new KernelContextProvider(this.kernel),
      new ReplyFormatContextProvider(),
    ]) {
      this.cleanups.push(this.kernel.contextProviderManager.register(provider));
    }
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  };
}
