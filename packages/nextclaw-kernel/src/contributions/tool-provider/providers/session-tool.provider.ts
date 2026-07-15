import type { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { SessionsHistoryTool, SessionsListTool } from "@kernel/tools/session-history.tools.js";
import { SessionRequestTool } from "@kernel/tools/session-request.tools.js";
import { SessionSearchTool } from "@kernel/tools/session-search.tools.js";
import { SessionSpawnTool } from "@kernel/tools/session-spawn.tools.js";
import { SessionsUpdateTool } from "@kernel/tools/session-update.tools.js";
import type { SessionSearchService } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";

export class SessionToolProvider implements ToolProvider {
  constructor(
    private readonly runContextService: ToolProviderRunContextService,
    private readonly sessionManager: SessionManager,
    private readonly sessionRequests: SessionRequestManager,
    private readonly sessionSearch: SessionSearchService,
  ) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const { toolRunContext } = await this.runContextService.resolve(request);
    const { handoffDepth, metadata, sessionId } = toolRunContext;
    const sessionsSpawnTool = new SessionSpawnTool(
      this.sessionManager,
      this.sessionRequests,
    );
    sessionsSpawnTool.setContext({
      sourceSessionId: sessionId,
      sourceSessionMetadata: metadata,
      handoffDepth,
    });

    const sessionsRequestTool = new SessionRequestTool(this.sessionRequests);
    sessionsRequestTool.setContext({
      sourceSessionId: sessionId,
      handoffDepth,
    });
    const tools: NcpTool[] = [
      sessionsSpawnTool,
      sessionsRequestTool,
      new SessionsListTool(this.sessionManager),
      new SessionsHistoryTool(this.sessionManager),
      new SessionsUpdateTool(this.sessionManager),
    ];
    if (!this.sessionSearch.isReady()) {
      return tools;
    }
    tools.push(
      new SessionSearchTool(
        { search: this.sessionSearch.search },
        { currentSessionId: sessionId },
      ),
    );
    return tools;
  };
}
