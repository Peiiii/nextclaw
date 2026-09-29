import {
  BUILTIN_MAIN_AGENT_ID,
  ContextWindowBudgetService,
  normalizeAgentProfileId,
  resolveConfiguredAgentProfiles,
  type Config,
  type CreateAgentProfileInput,
  type EffectiveAgentProfile,
  type UpdateAgentProfileInput,
} from "@nextclaw/core";

export type ResolvedAgentProfile = EffectiveAgentProfile & {
  contextTokens: number;
  model: string;
  reservedContextTokens: number;
};

export interface AgentProfilePersistence {
  loadConfig(): Config;
  resolveHome(config: Config, agentId: string): string;
  create(input: CreateAgentProfileInput): EffectiveAgentProfile | Promise<EffectiveAgentProfile>;
  update(input: UpdateAgentProfileInput): EffectiveAgentProfile | Promise<EffectiveAgentProfile>;
  remove(agentId: string): boolean | Promise<boolean>;
}

export class AgentManager {
  constructor(
    private readonly persistence: AgentProfilePersistence,
  ) {}

  listAgents = (): EffectiveAgentProfile[] =>
    this.resolveProfiles(this.loadConfig());

  getAgent = (agentId: string): EffectiveAgentProfile | null =>
    this.findProfile(this.loadConfig(), agentId);

  getDefaultAgentId = (): string =>
    this.defaultProfileId(this.loadConfig());

  resolveAgentProfile = (agentId?: string | null): ResolvedAgentProfile =>
    this.resolveAgentProfileFromConfig(this.loadConfig(), agentId);

  resolveAgentProfileForContextWindow = (params: {
    agentId: string;
    contextTokens: number;
  }): ResolvedAgentProfile =>
    this.resolveAgentProfileFromConfig(
      this.loadConfig(),
      params.agentId,
      params.contextTokens,
    );

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
    return await this.persistence.create(input);
  };

  updateAgent = async (input: UpdateAgentProfileInput): Promise<EffectiveAgentProfile> => {
    return await this.persistence.update(input);
  };

  removeAgent = async (agentId: string): Promise<boolean> => {
    return await this.persistence.remove(agentId);
  };

  private loadConfig = (): Config =>
    this.persistence.loadConfig();

  private resolveProfiles = (config: Config): EffectiveAgentProfile[] =>
    resolveConfiguredAgentProfiles(config, this.persistence.resolveHome);

  private findProfile = (config: Config, agentId: string): EffectiveAgentProfile | null =>
    this.resolveProfiles(config).find((profile) => profile.id === normalizeAgentProfileId(agentId)) ?? null;

  private defaultProfileId = (config: Config): string =>
    this.resolveProfiles(config).find((profile) => profile.default)?.id ?? BUILTIN_MAIN_AGENT_ID;

  private resolveAgentProfileFromConfig = (
    config: Config,
    agentId?: string | null,
    contextTokensOverride?: number,
  ): ResolvedAgentProfile => {
    const candidateAgentId = normalizeAgentProfileId(agentId) || this.defaultProfileId(config);
    const profile =
      this.findProfile(config, candidateAgentId) ??
      this.findProfile(config, this.defaultProfileId(config));
    if (!profile) {
      throw new Error(`default agent profile not found: ${BUILTIN_MAIN_AGENT_ID}`);
    }
    const contextTokens = contextTokensOverride
      ?? profile.contextTokens
      ?? config.agents.defaults.contextTokens;
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
