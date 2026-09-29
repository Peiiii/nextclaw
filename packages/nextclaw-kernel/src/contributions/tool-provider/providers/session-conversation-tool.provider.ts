import type { NcpTool } from "@nextclaw/ncp";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { UserQuestionManager } from "@kernel/managers/user-question.manager.js";
import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import { createPortableSessionHistoryTools } from "@kernel/tools/session-history.tools.js";
import { createPortableRequestUserInputAsyncTool } from "@kernel/tools/user-question.tools.js";

/** Common session tools and disclosure policy, shared by every platform. */
export class SessionConversationToolProvider implements ToolProvider {
  constructor(private readonly sessions: Pick<SessionManager,
    "getSession" | "listSessions" | "listSessionMessages" | "getAgentRunSession">,
    private readonly questions: Pick<UserQuestionManager, "ask">) {}

  provide = async (request: AgentRunRequest): Promise<readonly NcpTool[]> => {
    const tools = [...createPortableSessionHistoryTools(this.sessions)];
    if (request.sessionId && (!request.channel || request.channel === "ui")) {
      const session = await this.sessions.getAgentRunSession(request.sessionId);
      if (session.agentRuntimeId === "native") {
        tools.push(createPortableRequestUserInputAsyncTool((prompts) => this.questions.ask(request.sessionId!, prompts)));
      }
    }
    return tools;
  };
}
