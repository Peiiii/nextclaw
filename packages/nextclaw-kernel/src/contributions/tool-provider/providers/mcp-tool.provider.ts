import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { resolveToolProviderRunContext } from "@kernel/contributions/tool-provider/utils/tool-provider-run-context.utils.js";
import type { NcpTool } from "@nextclaw/ncp";

export class McpToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      kernel: this.kernel,
      request,
    });
    return this.kernel.mcpManager.listToolsForRun({ agentId: toolRunContext.agentId });
  };
}
