import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { resolveToolProviderRunContext } from "@kernel/contributions/tool-provider/utils/tool-provider-run-context.utils.js";
import { SessionsHistoryTool, SessionsListTool } from "@kernel/tools/session-history.tools.js";
import { SessionRequestTool } from "@kernel/tools/session-request.tools.js";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";
import { SessionSpawnTool } from "@kernel/tools/session-spawn.tools.js";
import type { NcpTool } from "@nextclaw/ncp";

export class SessionToolProvider implements ToolProvider {
  constructor(private readonly kernel: NextclawKernel) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await resolveToolProviderRunContext({
      kernel: this.kernel,
      request,
    });
    const { handoffDepth, metadata, sessionId } = toolRunContext;
    const sessionsSpawnTool = new SessionSpawnTool(
      this.kernel.ncpSessionManager,
      this.kernel.sessionRequests,
    );
    sessionsSpawnTool.setContext({
      sourceSessionId: sessionId,
      sourceSessionMetadata: metadata,
      handoffDepth,
    });

    const sessionsRequestTool = new SessionRequestTool(this.kernel.sessionRequests);
    sessionsRequestTool.setContext({
      sourceSessionId: sessionId,
      handoffDepth,
    });
    const tools: NcpTool[] = [
      sessionsSpawnTool,
      sessionsRequestTool,
      new SessionsListTool(this.kernel.ncpSessionManager),
      new SessionsHistoryTool(this.kernel.ncpSessionManager),
    ];
    if (!this.kernel.sessionSearch.isReady()) {
      return tools;
    }
    tools.push(
      new SessionSearchTool(
        { search: this.kernel.sessionSearch.search },
        { currentSessionId: sessionId },
      ),
    );
    return tools;
  };
}
