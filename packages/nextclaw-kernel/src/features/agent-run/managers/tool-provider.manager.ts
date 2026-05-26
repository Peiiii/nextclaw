import type { NcpTool } from "@nextclaw/ncp";
import type {
  Config,
  SearchConfig,
} from "@nextclaw/core";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/features/agent-run/types/agent-run.types.js";

export type ToolRunContext = {
  agentId: string;
  channel: string;
  chatId: string;
  config: Config;
  execTimeoutSeconds: number;
  handoffDepth: number;
  metadata: Record<string, unknown>;
  restrictToWorkspace: boolean;
  searchConfig: SearchConfig;
  sessionId: string;
  workspace: string;
};

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
    const seen = new Set<string>();
    for (const provider of [...this.providers]) {
      for (const tool of await provider.provide(request)) {
        if (seen.has(tool.name)) {
          continue;
        }
        seen.add(tool.name);
        tools.push(tool);
      }
    }
    return tools;
  };

  dispose = (): void => {
    this.providers.clear();
  };
}

export function resolveAgentHandoffDepth(metadata: Record<string, unknown>): number {
  const rawDepth = Number(metadata.agent_handoff_depth ?? 0);
  if (!Number.isFinite(rawDepth) || rawDepth < 0) {
    return 0;
  }
  return Math.trunc(rawDepth);
}
