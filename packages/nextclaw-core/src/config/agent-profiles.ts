import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  materializeAgentAvatar,
  readAgentAvatarContent as readAgentAvatarAssetContent,
  resolveAgentAvatarHomePath
} from "./agent-avatar.js";
import { loadConfig, saveConfig } from "./loader.js";
import type { Config } from "./schema.js";
import { expandHome } from "../utils/helpers.js";

export const BUILTIN_MAIN_AGENT_ID = "main";
export { resolveAgentAvatarHomePath } from "./agent-avatar.js";

type AgentProfile = Config["agents"]["list"][number];

export type EffectiveAgentProfile = AgentProfile & {
  id: string;
  workspace: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  builtIn?: boolean;
};

export type CreateAgentProfileInput = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  home?: string;
};

export type CreateAgentProfileOptions = {
  configPath?: string;
  initializeHomeDirectory?: (homeDirectory: string) => void;
};

export type UpdateAgentProfileInput = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
};

export type UpdateAgentProfileOptions = {
  configPath?: string;
};

export function normalizeAgentProfileId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function isBuiltinAgentId(agentId: string): boolean {
  return normalizeAgentProfileId(agentId) === BUILTIN_MAIN_AGENT_ID;
}

export function assertCreatableAgentId(agentId: string): string {
  const normalized = normalizeAgentProfileId(agentId);
  if (!normalized) {
    throw new Error("agent id is required");
  }
  if (normalized === BUILTIN_MAIN_AGENT_ID) {
    throw new Error(`agent id '${BUILTIN_MAIN_AGENT_ID}' is reserved`);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalized)) {
    throw new Error("agent id must match /^[a-z0-9][a-z0-9_-]*$/");
  }
  return normalized;
}

export function resolveEffectiveAgentProfiles(config: Config): EffectiveAgentProfile[] {
  const configured = Array.isArray(config.agents.list) ? config.agents.list : [];
  const mainOverride = configured.find((entry) => normalizeAgentProfileId(entry.id) === BUILTIN_MAIN_AGENT_ID);
  const extraAgents = configured.filter((entry) => normalizeAgentProfileId(entry.id) !== BUILTIN_MAIN_AGENT_ID);
  return [
    {
      id: BUILTIN_MAIN_AGENT_ID,
      default: true,
      workspace: mainOverride?.workspace?.trim() || config.agents.defaults.workspace,
      displayName: normalizeOptionalString(mainOverride?.displayName) ?? "Main",
      ...(normalizeOptionalString(mainOverride?.description)
        ? { description: normalizeOptionalString(mainOverride?.description) ?? undefined }
        : {}),
      ...(normalizeOptionalString(mainOverride?.avatar) ? { avatar: normalizeOptionalString(mainOverride?.avatar) ?? undefined } : {}),
      model: mainOverride?.model,
      engine: mainOverride?.engine,
      engineConfig: mainOverride?.engineConfig,
      thinkingDefault: mainOverride?.thinkingDefault,
      models: mainOverride?.models,
      contextTokens: mainOverride?.contextTokens,
      maxToolIterations: mainOverride?.maxToolIterations,
      builtIn: true
    },
    ...extraAgents
      .map((entry) => toEffectiveAgentProfile(entry, config))
      .filter((entry): entry is EffectiveAgentProfile => Boolean(entry))
  ];
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
  return resolve(expandHome(profile.workspace));
}

export function resolveAgentAvatarAssetPath(config: Config, agentId: string): string | null {
  const profile = findEffectiveAgentProfile(config, agentId);
  if (!profile?.avatar?.startsWith("home://")) {
    return null;
  }
  return resolveAgentAvatarHomePath({
    homeDirectory: resolve(expandHome(profile.workspace)),
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
  const description = normalizeOptionalString(input.description) ?? undefined;
  const avatar = materializeAgentAvatar({
    avatar: input.avatar,
    homeDirectory,
    agentId,
    displayName
  });

  const profile: AgentProfile = {
    id: agentId,
    default: false,
    workspace: storedHome,
    displayName,
    ...(description ? { description } : {}),
    avatar
  };

  config.agents.list = [...config.agents.list, profile];
  const next = config.agents.list
    .map((entry) => normalizeAgentProfileId(entry.id))
    .filter(Boolean);
  if (new Set(next).size !== next.length) {
    throw new Error(`agent '${agentId}' already exists`);
  }
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
  persistUpdatedAgentProfile(config, profileIndex, profile, options.configPath);
  return findEffectiveAgentProfile(config, agentId) as EffectiveAgentProfile;
}

export function removeAgentProfile(agentId: string, options: { configPath?: string } = {}): boolean {
  const normalized = normalizeAgentProfileId(agentId);
  if (!normalized) {
    throw new Error("agent id is required");
  }
  if (normalized === BUILTIN_MAIN_AGENT_ID) {
    throw new Error(`agent id '${BUILTIN_MAIN_AGENT_ID}' is reserved`);
  }
  const config = loadConfig(options.configPath);
  const before = config.agents.list.length;
  config.agents.list = config.agents.list.filter((entry) => normalizeAgentProfileId(entry.id) !== normalized);
  if (config.agents.list.length === before) {
    return false;
  }
  saveConfig(config, options.configPath);
  return true;
}

export function buildDefaultAgentHomePath(config: Config, agentId: string): string {
  const base = normalizeOptionalString(config.agents.defaults.workspace) ?? "~/.nextclaw/workspace";
  return join(dirname(base), `${basename(base)}-${agentId}`);
}

export function formatAgentDisplayName(agentId: string): string {
  return agentId
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function toEffectiveAgentProfile(entry: AgentProfile, config: Config): EffectiveAgentProfile | null {
  const id = normalizeAgentProfileId(entry.id);
  if (!id) {
    return null;
  }
  return {
    ...entry,
    id,
    workspace: normalizeOptionalString(entry.workspace) ?? config.agents.defaults.workspace,
    ...(normalizeOptionalString(entry.displayName) ? { displayName: normalizeOptionalString(entry.displayName) ?? undefined } : {}),
    ...(normalizeOptionalString(entry.description) ? { description: normalizeOptionalString(entry.description) ?? undefined } : {}),
    ...(normalizeOptionalString(entry.avatar) ? { avatar: normalizeOptionalString(entry.avatar) ?? undefined } : {})
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function ensureAgentProfileUpdateInput(input: UpdateAgentProfileInput): void {
  if (input.displayName !== undefined || input.description !== undefined || input.avatar !== undefined) {
    return;
  }
  throw new Error("at least one field must be provided");
}

function applyAgentProfileTextUpdate(profile: AgentProfile, key: "displayName" | "description", value?: string): void {
  if (value === undefined) {
    return;
  }
  const normalized = normalizeOptionalString(value);
  if (normalized) {
    profile[key] = normalized;
    return;
  }
  delete profile[key];
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
    homeDirectory: resolve(expandHome(existingEffective.workspace)),
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
