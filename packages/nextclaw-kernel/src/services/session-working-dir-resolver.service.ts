import { resolveSessionProjectContext } from "@nextclaw/core";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import { readOptionalString } from "@kernel/utils/session-manager.utils.js";

function stripProjectRootMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }
  const { project_root: _projectRootLegacy, projectRoot: _projectRoot, ...rest } = metadata;
  return rest;
}

export class SessionWorkingDirResolver {
  constructor(private readonly agentManager: AgentManager) {}

  withWorkingDir = (summary: NcpSessionSummary): NcpSessionSummary => {
    const context = this.resolveContext({
      agentId: summary.agentId,
      metadata: summary.metadata,
    });
    return {
      ...summary,
      metadata: context.projectRoot
        ? summary.metadata
        : stripProjectRootMetadata(summary.metadata),
      workingDir: context.effectiveWorkspace,
    };
  };

  resolve = (params: {
    agentId?: string;
    metadata?: Record<string, unknown>;
  }): string => {
    return this.resolveContext(params).effectiveWorkspace;
  };

  private resolveContext = (params: {
    agentId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const profile = this.agentManager.resolveAgentProfile(readOptionalString(params.agentId));
    return resolveSessionProjectContext({
      sessionMetadata: params.metadata,
      workspace: profile.workspace,
    });
  };
}
