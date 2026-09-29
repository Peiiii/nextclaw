import {
  BUILTIN_MAIN_AGENT_ID,
  normalizeAgentProfileId,
  projectConfiguredAgentProfile,
  resolveConfiguredAgentProfiles,
  type EffectiveAgentProfile,
} from "./agent-profile-resolution.utils.js";
export { BUILTIN_MAIN_AGENT_ID, normalizeAgentProfileId, type EffectiveAgentProfile } from "./agent-profile-resolution.utils.js";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  materializeAgentAvatar,
  readAgentAvatarContent as readAgentAvatarAssetContent,
  resolveAgentAvatarHomePath
} from "./agent-avatar.utils.js";
import {
  normalizeOptionalString,
} from "./agent-profile-runtime-fields.utils.js";
import {
  applyAgentProfileSettingsUpdate,
  insertConfiguredAgentProfile,
  removeConfiguredAgentProfile,
  applyAgentProfileTextUpdate,
  assertCreatableAgentId,
  ensureAgentProfileUpdateInput,
  formatAgentDisplayName,
  type CreateAgentProfileInput,
  type UpdateAgentProfileInput,
} from "./agent-profile-mutation.utils.js";
export { assertCreatableAgentId, formatAgentDisplayName, type CreateAgentProfileInput, type UpdateAgentProfileInput } from "./agent-profile-mutation.utils.js";
import { loadConfig, saveConfig } from "./config-loader.utils.js";
import type { Config } from "@core/features/config/configs/config-schema.config.js";
import { expandHome, getWorkspacePath } from "@core/shared/lib/core-utils/index.js";


const AGENT_HOME_DIRECTORY_SEGMENT = "agents";
export { resolveAgentAvatarHomePath } from "./agent-avatar.utils.js";

type AgentProfile = Config["agents"]["list"][number];



type CreateAgentProfileOptions = { configPath?: string; initializeHomeDirectory?: (homeDirectory: string) => void };

type UpdateAgentProfileOptions = { configPath?: string };



export function isBuiltinAgentId(agentId: string): boolean {
  return normalizeAgentProfileId(agentId) === BUILTIN_MAIN_AGENT_ID;
}

export function resolveEffectiveAgentProfiles(config: Config): EffectiveAgentProfile[] {
  return resolveConfiguredAgentProfiles(config, resolveImplicitAgentHomePath);
}

export function findEffectiveAgentProfile(config: Config, agentId: string): EffectiveAgentProfile | null {
  const normalized = normalizeAgentProfileId(agentId);
  if (!normalized) {
    return null;
  }
  return resolveEffectiveAgentProfiles(config).find((entry) => entry.id === normalized) ?? null;
}

export function resolveDefaultAgentProfileId(config: Config): string {
  return (
    resolveEffectiveAgentProfiles(config).find((entry) => entry.default === true)?.id ??
    BUILTIN_MAIN_AGENT_ID
  );
}

export function resolveAgentHomeDirectory(config: Config, agentId: string): string {
  const profile = findEffectiveAgentProfile(config, agentId);
  if (!profile) {
    throw new Error(`unknown agent: ${agentId}`);
  }
  return getWorkspacePath(profile.workspace);
}

export function resolveAgentAvatarAssetPath(config: Config, agentId: string): string | null {
  const profile = findEffectiveAgentProfile(config, agentId);
  if (!profile?.avatar?.startsWith("home://")) {
    return null;
  }
  return resolveAgentAvatarHomePath({
    homeDirectory: getWorkspacePath(profile.workspace),
    avatarRef: profile.avatar
  });
}

export function createAgentProfile(
  input: CreateAgentProfileInput,
  options: CreateAgentProfileOptions = {}
): EffectiveAgentProfile {
  const config = loadConfig(options.configPath);
  const agentId = assertCreatableAgentId(input.id);
  if (findEffectiveAgentProfile(config, agentId)) {
    throw new Error(`agent '${agentId}' already exists`);
  }

  const storedHome = normalizeOptionalString(input.home) ?? buildDefaultAgentHomePath(config, agentId);
  const homeDirectory = resolve(expandHome(storedHome));
  ensureCreatableHomeDirectory(homeDirectory);
  mkdirSync(homeDirectory, { recursive: true });
  options.initializeHomeDirectory?.(homeDirectory);

  const displayName = normalizeOptionalString(input.displayName) ?? formatAgentDisplayName(agentId);
  const avatar = materializeAgentAvatar({
    avatar: input.avatar,
    homeDirectory,
    agentId,
    displayName
  });

  const profile = insertConfiguredAgentProfile(config, input, { home: storedHome, avatar });
  saveConfig(config, options.configPath);
  return toEffectiveAgentProfile(profile, config) as EffectiveAgentProfile;
}

export function updateAgentProfile(
  input: UpdateAgentProfileInput,
  options: UpdateAgentProfileOptions = {}
): EffectiveAgentProfile {
  const { agentId, config, existingEffective, profileIndex, profile } = resolveAgentProfileUpdateContext(input.id, options.configPath);
  ensureAgentProfileUpdateInput(input);
  applyAgentProfileTextUpdate(profile, "displayName", input.displayName);
  applyAgentProfileTextUpdate(profile, "description", input.description);
  applyAgentProfileAvatarUpdate(profile, input.avatar, existingEffective, agentId);
  applyAgentProfileSettingsUpdate(profile, input);
  persistUpdatedAgentProfile(config, profileIndex, profile, options.configPath);
  return findEffectiveAgentProfile(config, agentId) as EffectiveAgentProfile;
}

export function removeAgentProfile(agentId: string, options: { configPath?: string } = {}): boolean {
  const config = loadConfig(options.configPath);
  if (!removeConfiguredAgentProfile(config, agentId)) return false;
  saveConfig(config, options.configPath);
  return true;
}

export function buildDefaultAgentHomePath(config: Config, agentId: string): string {
  return join(getWorkspacePath(config.agents.defaults.workspace), AGENT_HOME_DIRECTORY_SEGMENT, agentId);
}

export function resolveImplicitAgentHomePath(config: Config, agentId: string): string {
  const canonicalPath = buildDefaultAgentHomePath(config, agentId);
  const legacyPath = buildLegacyAgentHomePath(config, agentId);
  if (pathExists(canonicalPath) || !pathExists(legacyPath)) {
    return canonicalPath;
  }
  return legacyPath;
}

function toEffectiveAgentProfile(entry: AgentProfile, config: Config): EffectiveAgentProfile | null {
  return projectConfiguredAgentProfile(entry, config, resolveImplicitAgentHomePath);
}

function buildLegacyAgentHomePath(config: Config, agentId: string): string {
  const base = getWorkspacePath(config.agents.defaults.workspace);
  return join(dirname(base), `${basename(base)}-${agentId}`);
}

function pathExists(path: string): boolean {
  return existsSync(resolve(expandHome(path)));
}

function ensureCreatableHomeDirectory(homeDirectory: string): void {
  if (!existsSync(homeDirectory)) {
    return;
  }
  const stats = statSync(homeDirectory);
  if (!stats.isDirectory()) {
    throw new Error(`agent home already exists and is not a directory: ${homeDirectory}`);
  }
  if (readdirSync(homeDirectory).length > 0) {
    throw new Error(`agent home already exists and is not empty: ${homeDirectory}`);
  }
}

export function readAgentAvatarContent(params: {
  config: Config;
  agentId: string;
}): { bytes: Uint8Array; mimeType: string } | null {
  return readAgentAvatarAssetContent({
    ...params,
    resolveAssetPath: resolveAgentAvatarAssetPath
  });
}

function resolveAgentProfileUpdateContext(agentIdInput: string, configPath?: string): {
  agentId: string;
  config: Config;
  existingEffective: EffectiveAgentProfile;
  profileIndex: number;
  profile: AgentProfile;
} {
  const agentId = normalizeAgentProfileId(agentIdInput);
  if (!agentId) {
    throw new Error("agent id is required");
  }
  const config = loadConfig(configPath);
  const existingEffective = findEffectiveAgentProfile(config, agentId);
  if (!existingEffective) {
    throw new Error(`agent '${agentId}' not found`);
  }
  const profileIndex = config.agents.list.findIndex((entry) => normalizeAgentProfileId(entry.id) === agentId);
  const profile = profileIndex >= 0
    ? { ...config.agents.list[profileIndex] }
    : { id: agentId, default: agentId === BUILTIN_MAIN_AGENT_ID };
  return { agentId, config, existingEffective, profileIndex, profile };
}

function applyAgentProfileAvatarUpdate(
  profile: AgentProfile,
  avatar: string | undefined,
  existingEffective: EffectiveAgentProfile,
  agentId: string
): void {
  if (avatar === undefined) {
    return;
  }
  const normalized = normalizeOptionalString(avatar);
  if (!normalized) {
    delete profile.avatar;
    return;
  }
  profile.avatar = materializeAgentAvatar({
    avatar: normalized,
    homeDirectory: getWorkspacePath(existingEffective.workspace),
    agentId,
    displayName: profile.displayName ?? existingEffective.displayName ?? formatAgentDisplayName(agentId)
  });
}

function persistUpdatedAgentProfile(config: Config, profileIndex: number, profile: AgentProfile, configPath?: string): void {
  if (profileIndex >= 0) {
    config.agents.list[profileIndex] = profile;
  } else {
    config.agents.list = [...config.agents.list, profile];
  }
  saveConfig(config, configPath);
}
