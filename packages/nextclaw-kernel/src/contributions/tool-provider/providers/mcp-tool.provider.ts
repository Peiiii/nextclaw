import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";

export class McpToolProvider implements ToolProvider {
  readonly id = "nextclaw-mcp-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    for (const tool of this.kernel.mcpManager.listToolsForRun({ agentId: context.agentId })) {
      registry.registerNcpTool(tool);
    }
  };
}
