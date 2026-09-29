import { NextclawKernel, type NextclawKernelOptions } from "@kernel/app/nextclaw-kernel.js";
import type { AgentKernel } from "@kernel/managers/agent-kernel.manager.js";
import type { AgentKernelModule, AgentPlatform } from "@kernel/types/agent-platform.types.js";
import { NodePlatform } from "./node-platform.service.js";

export type NextclawApplicationOptions = NextclawKernelOptions & {
  allowedToolNames?: readonly string[];
};

/** Full local product features attached to the Harness-owned AgentKernel. */
export class LocalProduct implements AgentKernelModule {
  readonly platform: AgentPlatform;
  private readonly native: NodePlatform;
  private product: NextclawKernel | undefined;

  constructor(private readonly options: NextclawApplicationOptions = {}) {
    this.native = new NodePlatform({ ...options,
      beforeDeleteSession: async (id) => { await this.product?.observations.removeSession(id); } });
    this.platform = {
      start: async () => {
        // The full product installs its richer ordered context contribution.
        const { contextFiles: _files, runtimeInfo: _runtime, ...resources } = await this.native.start();
        return resources;
      },
      dispose: this.native.dispose,
    };
  }

  get kernel(): NextclawKernel {
    if (!this.product) throw new Error("Local product has not been prepared by Harness.");
    return this.product;
  }

  attach = (kernel: AgentKernel): void => {
    if (this.product) throw new Error("Local product is already attached.");
    this.product = new NextclawKernel(kernel, this.native, this.options);
    if (this.options.allowedToolNames) kernel.toolProviderManager.restrictToTools(this.options.allowedToolNames);
  };

  start = async (): Promise<void> => { await this.kernel.start(); };
  ready = async (): Promise<void> => { await this.kernel.ready(); };
  stop = async (): Promise<void> => { await this.product?.stop(); };
  dispose = async (): Promise<void> => {
    const product = this.product;
    this.product = undefined;
    await product?.dispose();
  };
}
