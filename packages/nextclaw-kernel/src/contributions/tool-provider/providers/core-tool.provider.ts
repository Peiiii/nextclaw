import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";
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

export class CoreToolProvider implements ToolProvider {
  readonly id = "nextclaw-core-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    const {
      channel,
      chatId,
      execTimeoutSeconds,
      restrictToWorkspace,
      searchConfig,
      sessionId,
      workspace,
    } = context;
    const allowedDir = restrictToWorkspace ? workspace : undefined;
    registry.registerTool(new ReadFileTool(allowedDir));
    registry.registerTool(new WriteFileTool(allowedDir));
    registry.registerTool(new EditFileTool(allowedDir));
    registry.registerTool(new ListDirTool(allowedDir));

    const execTool = new ExecTool({
      workingDir: workspace,
      timeout: execTimeoutSeconds,
      restrictToWorkspace,
    });
    execTool.setContext({
      sessionKey: sessionId,
      channel,
      chatId,
    });
    registry.registerTool(execTool);

    registry.registerTool(new WebSearchTool(searchConfig));
    registry.registerTool(new WebFetchTool());
    registry.registerTool(new MemorySearchTool(workspace));
    registry.registerTool(new MemoryGetTool(workspace));

    const gatewayTool = new GatewayTool(this.kernel.getGatewayController());
    gatewayTool.setContext({ sessionKey: sessionId });
    registry.registerTool(gatewayTool);
  };
}
