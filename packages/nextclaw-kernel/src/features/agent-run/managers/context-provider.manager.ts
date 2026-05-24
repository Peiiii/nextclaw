import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/features/agent-run/types/agent-run.types.js";

export class ContextProviderManager {
  private readonly providers = new Set<ContextProvider>();

  register = (provider: ContextProvider): (() => void) => {
    this.providers.add(provider);
    return () => {
      this.providers.delete(provider);
    };
  };

  buildContext = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const blocks: ContextBlock[] = [];
    for (const provider of [...this.providers]) {
      blocks.push(...await provider.provide(request));
    }
    return blocks;
  };

  dispose = (): void => {
    this.providers.clear();
  };
}
