import type { NcpTool } from "@nextclaw/ncp";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/features/agent-run/types/agent-run.types.js";

export class ToolProviderManager {
  private readonly providers = new Set<ToolProvider>();

  register = (provider: ToolProvider): (() => void) => {
    this.providers.add(provider);
    return () => {
      this.providers.delete(provider);
    };
  };

  buildTools = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const tools: NcpTool[] = [];
    for (const provider of [...this.providers]) {
      tools.push(...await provider.provide(request));
    }
    return tools;
  };

  dispose = (): void => {
    this.providers.clear();
  };
}
