import type { Config } from "@core/features/config/configs/config-schema.config.js";
import { BUILTIN_MAIN_AGENT_ID, normalizeAgentProfileId } from "./agent-profile-resolution.utils.js";
import {
  applyAgentProfileModelUpdate,
  applyAgentProfileRuntimeUpdate,
  buildAgentAdvancedPatch,
  buildAgentModelPatch,
  buildAgentRuntimePatch,
  hasAgentProfileAdvancedInput,
  normalizeOptionalString,
  type AgentProfileAdvancedInput,
} from "./agent-profile-runtime-fields.utils.js";

type AgentProfile = Config["agents"]["list"][number];

export type CreateAgentProfileInput = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  home?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  engine?: string;
  engineConfig?: Record<string, unknown> | null;
} & AgentProfileAdvancedInput;

export type UpdateAgentProfileInput = Omit<CreateAgentProfileInput, "home">;

export function assertCreatableAgentId(agentId: string): string {
  const normalized = normalizeAgentProfileId(agentId);
  if (!normalized) throw new Error("agent id is required");
  if (normalized === BUILTIN_MAIN_AGENT_ID) {
    throw new Error(`agent id '${BUILTIN_MAIN_AGENT_ID}' is reserved`);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
    throw new Error("agent id must match /^[a-z0-9][a-z0-9_-]*$/");
  }
  return normalized;
}

export function formatAgentDisplayName(agentId: string): string {
  return agentId.split(/[-_]+/g).filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1)).join(" ");
}

export function ensureAgentProfileUpdateInput(input: UpdateAgentProfileInput): void {
  if (
    input.displayName !== undefined || input.description !== undefined ||
    input.avatar !== undefined || input.model !== undefined ||
    input.runtime !== undefined || input.runtimeConfig !== undefined ||
    input.engine !== undefined || input.engineConfig !== undefined ||
    hasAgentProfileAdvancedInput(input)
  ) return;
  throw new Error("at least one field must be provided");
}

export function applyAgentProfileTextUpdate(
  profile: AgentProfile, key: "displayName" | "description", value?: string,
): void {
  if (value === undefined) return;
  const normalized = normalizeOptionalString(value);
  if (normalized) profile[key] = normalized;
  else delete profile[key];
}

export function applyAgentProfileSettingsUpdate(profile: AgentProfile, input: UpdateAgentProfileInput): void {
  applyAgentProfileModelUpdate(profile, input.model);
  applyAgentProfileRuntimeUpdate(profile, input);
  if (input.contextTokens === null) delete profile.contextTokens;
  Object.assign(profile, buildAgentAdvancedPatch(input));
}

/** Shared profile mutation, after the platform has prepared its home and avatar. */
export function insertConfiguredAgentProfile(config: Config, input: CreateAgentProfileInput,
  prepared: { home: string; avatar?: string }): AgentProfile {
  const id = assertCreatableAgentId(input.id);
  if (config.agents.list.some((entry) => normalizeAgentProfileId(entry.id) === id)) {
    throw new Error(`agent '${id}' already exists`);
  }
  const profile: AgentProfile = {
    id, default: false, workspace: prepared.home,
    displayName: normalizeOptionalString(input.displayName) ?? formatAgentDisplayName(id),
    ...(normalizeOptionalString(input.description) ? { description: input.description!.trim() } : {}),
    ...(prepared.avatar ? { avatar: prepared.avatar } : {}),
    ...buildAgentModelPatch(input.model), ...buildAgentRuntimePatch(input), ...buildAgentAdvancedPatch(input),
  };
  config.agents.list = [...config.agents.list, profile];
  return profile;
}

export function removeConfiguredAgentProfile(config: Config, agentId: string): boolean {
  const id = normalizeAgentProfileId(agentId);
  if (!id) throw new Error("agent id is required");
  if (id === BUILTIN_MAIN_AGENT_ID) throw new Error(`agent id '${BUILTIN_MAIN_AGENT_ID}' is reserved`);
  const before = config.agents.list.length;
  config.agents.list = config.agents.list.filter((entry) => normalizeAgentProfileId(entry.id) !== id);
  return before !== config.agents.list.length;
}
