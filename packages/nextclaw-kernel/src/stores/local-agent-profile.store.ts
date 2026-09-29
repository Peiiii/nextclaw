import {
  createAgentProfile, loadConfig, removeAgentProfile, resolveImplicitAgentHomePath,
  updateAgentProfile, type CreateAgentProfileInput, type UpdateAgentProfileInput,
  type Config, type EffectiveAgentProfile,
} from "@nextclaw/core";
import type { AgentProfilePersistence } from "@kernel/managers/agent.manager.js";

/** Keeps the existing local directory, avatar and configuration persistence rules. */
export class LocalAgentProfileStore implements AgentProfilePersistence {
  constructor(private readonly options: {
    configPath?: string;
    initializeHomeDirectory?: (homeDirectory: string) => void;
    changed?: () => void | Promise<void>;
  } = {}) {}

  loadConfig = (): Config => loadConfig(this.options.configPath);
  resolveHome = resolveImplicitAgentHomePath;
  create = async (input: CreateAgentProfileInput): Promise<EffectiveAgentProfile> => {
    const profile = createAgentProfile(input, this.options);
    await this.options.changed?.();
    return profile;
  };
  update = async (input: UpdateAgentProfileInput): Promise<EffectiveAgentProfile> => {
    const profile = updateAgentProfile(input, this.options);
    await this.options.changed?.();
    return profile;
  };
  remove = async (agentId: string): Promise<boolean> => {
    const removed = removeAgentProfile(agentId, this.options);
    if (removed) await this.options.changed?.();
    return removed;
  };
}
