import {
  type Disposable,
  type Config,
} from "@nextclaw/core";
import type { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  AgentRuntimeRegistry,
  type AgentRuntimeSessionTypeDescribeParams,
  type AgentRuntimeProviderRegistration,
  resolveAgentRuntimeEntries,
} from "@kernel/features/runtime-registry/index.js";


export type AgentRuntimeManagerOptions = {
  configManager: { loadConfig: () => Config };
  assetStore: LocalAssetStore;
};

export class AgentRuntimeManager {
  private readonly runtimeRegistry = new AgentRuntimeRegistry();
  private readonly refreshConfiguredRuntimeEntries = () => {
    this.runtimeRegistry.applyEntries(
      resolveAgentRuntimeEntries({
        config: this.params.configManager.loadConfig(),
      }),
    );
  };

  private disposed = false;

  constructor(private readonly params: AgentRuntimeManagerOptions) {}

  registerRuntimeProvider = (registration: AgentRuntimeProviderRegistration): Disposable => {
    this.assertNotDisposed();
    const disposable = this.runtimeRegistry.register(registration);
    this.refreshConfiguredRuntimeEntries();
    return disposable;
  };

  createRuntime = (runtimeParams: RuntimeFactoryParams) => {
    this.assertNotDisposed();
    this.refreshConfiguredRuntimeEntries();
    return this.runtimeRegistry.createRuntime({
      ...runtimeParams,
      resolveAssetContentPath: (assetUri) => this.params.assetStore.resolveContentPath(assetUri),
    });
  };

  listSessionTypes = (describeParams?: AgentRuntimeSessionTypeDescribeParams) => {
    this.refreshConfiguredRuntimeEntries();
    return this.runtimeRegistry.listSessionTypes(describeParams);
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
  };

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Agent runtime has already been disposed.");
    }
  };
}
