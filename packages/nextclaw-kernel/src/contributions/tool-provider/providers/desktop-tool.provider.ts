import {
  DesktopNodeReplService,
  DesktopSessionStateService,
  type DesktopHostCapabilityManager,
} from "@kernel/features/desktop-host/index.js";
import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import { createDesktopNodeReplTool } from "@kernel/tools/desktop-node-repl.tools.js";
import type {
  AgentRunRequest,
  ToolProvider,
} from "@kernel/types/agent-run.types.js";
import type { NcpTool } from "@nextclaw/ncp";

export class DesktopToolProvider implements ToolProvider {
  private readonly sessionState: DesktopSessionStateService;
  private readonly repl: DesktopNodeReplService;

  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly manager: DesktopHostCapabilityManager,
  ) {
    this.sessionState = new DesktopSessionStateService(manager);
    this.repl = new DesktopNodeReplService(this.sessionState);
  }

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { requestMetadata, toolRunContext } =
      await this.runContextService.resolve(request);
    const agentRunId = readOptionalString(
      requestMetadata.agent_run_id ?? requestMetadata.agentRunId,
    );
    const context = {
      agentId: toolRunContext.agentId,
      sessionId: toolRunContext.sessionId,
      ...(agentRunId ? { agentRunId } : {}),
    };
    return [createDesktopNodeReplTool(this.repl, context)];
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
