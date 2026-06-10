import { resolveSessionWorkspacePath } from "@nextclaw/core";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { readOptionalString } from "@kernel/utils/session-manager.utils.js";

export class SessionWorkingDirResolver {
  constructor(private readonly agentManager: AgentManager) {}

  withWorkingDir = (summary: NcpSessionSummary): NcpSessionSummary => ({
    ...summary,
    workingDir: this.resolve({
      agentId: summary.agentId,
      metadata: summary.metadata,
    }),
  });

  resolve = (params: {
    agentId?: string;
    metadata?: Record<string, unknown>;
  }): string => {
    const profile = this.agentManager.resolveAgentProfile(readOptionalString(params.agentId));
    return resolveSessionWorkspacePath({
      sessionMetadata: params.metadata,
      workspace: profile.workspace,
    });
  };
}
