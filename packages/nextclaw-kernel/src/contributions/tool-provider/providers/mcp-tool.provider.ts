import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/features/agent-run/index.js";
import { resolveToolProviderRunContext } from "@kernel/contributions/tool-provider/utils/tool-provider-run-context.utils.js";
import type { NcpTool } from "@nextclaw/ncp";

export class McpToolProvider implements ToolProvider {
  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      branch: this.branch,
      kernel: this.kernel,
      request,
    });
    return this.kernel.mcpManager.listToolsForRun({ agentId: toolRunContext.agentId });
  };
}
