import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { McpManager } from "@kernel/managers/mcp.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class McpToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly mcpManager: McpManager,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
    return this.mcpManager.listToolsForRun({ agentId: toolRunContext.agentId });
  };
}
