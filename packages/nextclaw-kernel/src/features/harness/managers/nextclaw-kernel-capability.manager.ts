import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { Disposer, EventBus, Ingress } from "@nextclaw/shared";
import type {
  IContextRegistry,
  IKernel,
  IMcpRegistry,
  IModelRegistry,
  IRuntimeRegistry,
  IToolRegistry,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

export class NextclawKernelFacade implements IKernel {
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
  readonly tools: IToolRegistry;
  readonly context: IContextRegistry;
  readonly models: IModelRegistry;
  readonly runtimes: IRuntimeRegistry;
  readonly mcp: IMcpRegistry;

  constructor(private readonly kernel: NextclawKernel) {
    this.eventBus = kernel.eventBus;
    this.ingress = kernel.ingress;
    this.tools = {
      register: (tool): Disposer =>
        this.kernel.toolProviderManager.register({
          provide: () => [tool],
        }),
    };
    this.context = {
      register: (provider): Disposer =>
        this.kernel.contextProviderManager.register(provider),
    };
    this.models = {
      registerProvider: (plugin): Disposer =>
        this.kernel.llmProviders.registerProviderPlugin(plugin),
      listProviders: () => this.kernel.llmProviders.listProviderSpecs(),
      chat: this.kernel.llmProviders.chat,
      chatStream: this.kernel.llmProviders.chatStream,
    };
    this.runtimes = {
      registerProvider: (provider) =>
        this.kernel.agentRuntimeManager.registerProvider(provider, {
          resolveAssetContentPath: this.kernel.assetStore.resolveContentPath,
        }),
      registerEntry: this.kernel.agentRuntimeManager.registerEntry,
      listSessionTypes: this.kernel.agentRuntimeManager.listSessionTypes,
    };
    this.mcp = {
      registerServer: this.kernel.mcpManager.registerServer,
      listServers: this.kernel.mcpManager.listServers,
      listTools: this.kernel.mcpManager.listTools,
      callTool: this.kernel.mcpManager.callTool,
    };
  }
}
