import {
  findEffectiveAgentProfile,
  resolveDefaultAgentProfileId,
  resolveSessionWorkspacePath,
} from "@nextclaw/core";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { readOptionalString } from "@kernel/utils/session-manager.utils.js";

export class SessionWorkingDirResolver {
  constructor(private readonly configManager: ConfigManager) {}

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
    const config = this.configManager.loadConfig();
    const defaultAgentId = resolveDefaultAgentProfileId(config);
    const profile =
      findEffectiveAgentProfile(config, readOptionalString(params.agentId) ?? defaultAgentId) ??
      findEffectiveAgentProfile(config, defaultAgentId);
    return resolveSessionWorkspacePath({
      sessionMetadata: params.metadata,
      workspace: profile?.workspace ?? config.agents.defaults.workspace,
    });
  };
}
