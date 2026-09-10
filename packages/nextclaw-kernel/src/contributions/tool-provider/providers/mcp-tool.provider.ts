import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { FeatureControlsService } from "@kernel/features/feature-controls/index.js";
import type { McpManager } from "@kernel/managers/mcp.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class McpToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly mcpManager: McpManager,
    private readonly featureControls?: FeatureControlsService,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    // 降级执行门（闭环环节②）：核心不健康且 autoDegrade 时关闭 MCP 工具，
    // 最小核心（对话、会话）保持可用。featureControls 缺省时保持原行为。
    if (this.featureControls && !(await this.featureControls.get()).mcp.active) {
      return [];
    }
    const { toolRunContext } = await this.runContextService.resolve(request);
    return this.mcpManager.listToolsForRun({ agentId: toolRunContext.agentId });
  };
}
