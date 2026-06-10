import {
  BUILTIN_MAIN_AGENT_ID,
  ContextWindowBudgetService,
  createAgentProfile,
  findEffectiveAgentProfile,
  loadConfig,
  normalizeAgentProfileId,
  removeAgentProfile,
  resolveDefaultAgentProfileId,
  resolveEffectiveAgentProfiles,
  updateAgentProfile,
  type Config,
  type CreateAgentProfileInput,
  type EffectiveAgentProfile,
  type UpdateAgentProfileInput,
} from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";

export type ResolvedAgentProfile = EffectiveAgentProfile & {
  contextTokens: number;
  model: string;
  reservedContextTokens: number;
};

export type AgentManagerOptions = {
  configPath?: string;
  initializeAgentHomeDirectory?: (homeDirectory: string) => void;
};

export class AgentManager {
  constructor(
    private readonly configManager?: Pick<ConfigManager, "applyLiveConfigReload" | "loadConfig">,
    private readonly options: AgentManagerOptions = {},
  ) {}

  listAgents = (): EffectiveAgentProfile[] =>
    resolveEffectiveAgentProfiles(this.loadConfig());

  getAgent = (agentId: string): EffectiveAgentProfile | null =>
    findEffectiveAgentProfile(this.loadConfig(), agentId);

  getDefaultAgentId = (): string =>
    resolveDefaultAgentProfileId(this.loadConfig());

  resolveAgentProfile = (agentId?: string | null): ResolvedAgentProfile =>
    this.resolveAgentProfileFromConfig(this.loadConfig(), agentId);

  resolveAgentProfileForRun = (params: {
    agentId?: string | null;
    requestMetadata?: Record<string, unknown>;
    storedAgentId?: string | null;
  } = {}): ResolvedAgentProfile =>
    this.resolveAgentProfile(
      params.agentId ??
        params.storedAgentId ??
        readRequestedAgentId(params.requestMetadata ?? {}) ??
        null,
    );

  createAgent = async (input: CreateAgentProfileInput): Promise<EffectiveAgentProfile> => {
    const agent = createAgentProfile(input, {
      configPath: this.options.configPath,
      initializeHomeDirectory: this.options.initializeAgentHomeDirectory,
    });
    await this.reloadLiveConfig();
    return agent;
  };

  updateAgent = async (input: UpdateAgentProfileInput): Promise<EffectiveAgentProfile> => {
    const agent = updateAgentProfile(input, {
      configPath: this.options.configPath,
    });
    await this.reloadLiveConfig();
    return agent;
  };

  removeAgent = async (agentId: string): Promise<boolean> => {
    const removed = removeAgentProfile(agentId, {
      configPath: this.options.configPath,
    });
    if (removed) {
      await this.reloadLiveConfig();
    }
    return removed;
  };

  private loadConfig = (): Config =>
    this.configManager?.loadConfig() ?? loadConfig(this.options.configPath);

  private reloadLiveConfig = async (): Promise<void> => {
    await this.configManager?.applyLiveConfigReload();
  };

  private resolveAgentProfileFromConfig = (config: Config, agentId?: string | null): ResolvedAgentProfile => {
    const candidateAgentId = normalizeAgentProfileId(agentId) || resolveDefaultAgentProfileId(config);
    const profile =
      findEffectiveAgentProfile(config, candidateAgentId) ??
      findEffectiveAgentProfile(config, resolveDefaultAgentProfileId(config));
    if (!profile) {
      throw new Error(`default agent profile not found: ${BUILTIN_MAIN_AGENT_ID}`);
    }
    const contextTokens = profile.contextTokens ?? config.agents.defaults.contextTokens;
    return {
      ...profile,
      contextTokens,
      model: profile.model ?? config.agents.defaults.model,
      reservedContextTokens: ContextWindowBudgetService.resolveReservedContextTokens({
        contextTokens,
        configuredReservedContextTokens:
          profile.reservedContextTokens ?? config.agents.defaults.reservedContextTokens,
      }),
    };
  };
}

function readRequestedAgentId(metadata: Record<string, unknown>): string | null {
  return (
    normalizeAgentProfileId(metadata.agent_id) ||
    normalizeAgentProfileId(metadata.agentId) ||
    null
  );
}
