import type {
  CompanionAgentProfile,
  CompanionAvatarView,
  CompanionOfflineReason,
  CompanionSessionViewInput
} from "../types/companion.types.js";

export class CompanionSessionViewService {
  constructor(
    private readonly baseUrl: string,
    private readonly resolveAvatarUrl: (agentId: string) => string
  ) {}

  readonly selectView = (input: CompanionSessionViewInput): CompanionAvatarView => {
    const runningSession = [...input.sessions]
      .filter((session) => session.status === "running")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    if (!runningSession) {
      return {
        state: "idle",
        title: "NextClaw",
        subtitle: "No active agent",
        openUrl: this.baseUrl
      };
    }

    const agent = this.findAgent(input.agents, runningSession.agentId);

    return {
      state: "running",
      title: agent?.displayName?.trim() || runningSession.agentId || "Active Agent",
      subtitle: runningSession.sessionId,
      avatarUrl: runningSession.agentId ? this.resolveAvatar(agent, runningSession.agentId) : undefined,
      sessionId: runningSession.sessionId,
      agentId: runningSession.agentId,
      openUrl: this.baseUrl
    };
  };

  readonly createOfflineView = (reason?: CompanionOfflineReason): CompanionAvatarView => {
    return {
      state: "offline",
      title: "NextClaw",
      subtitle: reason?.summary?.trim() || "Runtime unavailable",
      openUrl: this.baseUrl
    };
  };

  private readonly findAgent = (
    agents: CompanionAgentProfile[],
    agentId: string | undefined
  ): CompanionAgentProfile | null => {
    if (!agentId) {
      return null;
    }
    return agents.find((agent) => agent.id === agentId) ?? null;
  };

  private readonly resolveAvatar = (agent: CompanionAgentProfile | null, agentId: string): string => {
    return agent?.avatarUrl?.trim() || this.resolveAvatarUrl(agentId);
  };
}
