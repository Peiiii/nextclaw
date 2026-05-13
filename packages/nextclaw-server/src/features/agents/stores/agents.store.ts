import {
  createAgentProfile,
  findEffectiveAgentProfile,
  loadConfig,
  readAgentAvatarContent,
  removeAgentProfile,
  resolveEffectiveAgentProfiles,
  updateAgentProfile,
  type Config
} from "@nextclaw/core";
import type { AgentCreateRequest, AgentDeleteResult, AgentProfileView, AgentUpdateRequest } from "@nextclaw-server/shared/types/server-api.types.js";

export function listAgents(configPath: string): AgentProfileView[] {
  const config = loadConfig(configPath);
  return resolveEffectiveAgentProfiles(config).map((profile) => toAgentProfileView(config, profile.id));
}

export function createAgent(
  configPath: string,
  input: AgentCreateRequest,
  options: { initializeAgentHomeDirectory?: (homeDirectory: string) => void } = {}
): AgentProfileView {
  const created = createAgentProfile(
    {
      id: input.id,
      displayName: input.displayName,
      description: input.description,
      avatar: input.avatar,
      home: input.home,
      model: input.model,
      runtime: input.runtime,
      runtimeConfig: input.runtimeConfig
    },
    {
      configPath,
      initializeHomeDirectory: options.initializeAgentHomeDirectory
    }
  );
  const config = loadConfig(configPath);
  return toAgentProfileView(config, created.id);
}

export function deleteAgent(configPath: string, agentId: string): AgentDeleteResult | null {
  const deleted = removeAgentProfile(agentId, { configPath });
  if (!deleted) {
    return null;
  }
  return {
    deleted: true,
    agentId: agentId.trim().toLowerCase()
  };
}

export function updateAgent(configPath: string, agentId: string, input: AgentUpdateRequest): AgentProfileView {
  const updated = updateAgentProfile(
    {
      id: agentId,
      displayName: input.displayName,
      description: input.description,
      avatar: input.avatar,
      model: input.model,
      runtime: input.runtime,
      runtimeConfig: input.runtimeConfig
    },
    { configPath }
  );
  const config = loadConfig(configPath);
  return toAgentProfileView(config, updated.id);
}

export function readAgentAvatar(
  configPath: string,
  agentId: string
): { bytes: Uint8Array; mimeType: string } | null {
  const config = loadConfig(configPath);
  return readAgentAvatarContent({ config, agentId });
}

export function toAgentProfileView(config: Config, agentId: string): AgentProfileView {
  const profile = findEffectiveAgentProfile(config, agentId);
  if (!profile) {
    throw new Error(`unknown agent: ${agentId}`);
  }
  return {
    id: profile.id,
    default: profile.default,
    displayName: profile.displayName,
    description: profile.description,
    avatar: profile.avatar,
    avatarUrl: buildAgentAvatarUrl(profile.id, profile.avatar),
    workspace: profile.workspace,
    model: profile.model,
    runtime: profile.runtime,
    runtimeConfig: profile.runtimeConfig,
    engine: profile.engine,
    engineConfig: profile.engineConfig,
    contextTokens: profile.contextTokens,
    maxToolIterations: profile.maxToolIterations,
    builtIn: profile.builtIn === true
  };
}

export function buildAgentAvatarUrl(agentId: string, avatar?: string): string | undefined {
  const normalized = typeof avatar === "string" ? avatar.trim() : "";
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  if (normalized.startsWith("home://")) {
    return `/api/agents/${encodeURIComponent(agentId)}/avatar`;
  }
  return undefined;
}
