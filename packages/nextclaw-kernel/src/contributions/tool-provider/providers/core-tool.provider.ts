import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { resolveToolProviderRunContext } from "@kernel/contributions/tool-provider/utils/tool-provider-run-context.utils.js";
import {
  EditFileTool,
  ExecTool,
  GatewayTool,
  ListDirTool,
  MemoryGetTool,
  MemorySearchTool,
  ReadFileTool,
  WebFetchTool,
  WebSearchTool,
  WriteFileTool,
} from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

export class CoreToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      kernel: this.kernel,
      request,
    });
    const {
      channel,
      chatId,
      execTimeoutSeconds,
      restrictToWorkspace,
      searchConfig,
      sessionId,
      workspace,
    } = toolRunContext;
    const allowedDir = restrictToWorkspace ? workspace : undefined;
    const execTool = new ExecTool({
      restrictToWorkspace,
      timeout: execTimeoutSeconds,
      workingDir: workspace,
    });
    execTool.setContext({ channel, chatId, sessionKey: sessionId });
    const gatewayTool = new GatewayTool(this.kernel.getGatewayController());
    gatewayTool.setContext({ sessionKey: sessionId });
    return [
      new ReadFileTool(allowedDir),
      new WriteFileTool(allowedDir),
      new EditFileTool(allowedDir),
      new ListDirTool(allowedDir),
      execTool,
      new WebSearchTool(searchConfig),
      new WebFetchTool(),
      new MemorySearchTool(workspace),
      new MemoryGetTool(workspace),
      gatewayTool,
    ];
  };
}
