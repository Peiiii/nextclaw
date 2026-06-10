import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import {
  EditFileTool,
  ExecTool,
  type GatewayController,
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
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly getGatewayController: () => GatewayController | undefined,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
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
    const gatewayTool = new GatewayTool(this.getGatewayController());
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
