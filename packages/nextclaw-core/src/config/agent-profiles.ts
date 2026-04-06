import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, normalize, resolve } from "node:path";
import { loadConfig, saveConfig } from "./loader.js";
import type { Config } from "./schema.js";
import { expandHome } from "../utils/helpers.js";

export const BUILTIN_MAIN_AGENT_ID = "main";

type AgentProfile = Config["agents"]["list"][number];

export type EffectiveAgentProfile = AgentProfile & {
  id: string;
  workspace: string;
  displayName?: string;
  avatar?: string;
  builtIn?: boolean;
};

export type CreateAgentProfileInput = {
  id: string;
  displayName?: string;
  avatar?: string;
  home?: string;
};

export type CreateAgentProfileOptions = {
  configPath?: string;
  initializeHomeDirectory?: (homeDirectory: string) => void;
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
      displayName: normalizeOptionalDisplayName(mainOverride?.displayName) ?? "Main",
      ...(normalizeOptionalRef(mainOverride?.avatar) ? { avatar: normalizeOptionalRef(mainOverride?.avatar) ?? undefined } : {}),
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

  const displayName = normalizeOptionalDisplayName(input.displayName) ?? formatAgentDisplayName(agentId);
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
    ...(normalizeOptionalDisplayName(entry.displayName) ? { displayName: normalizeOptionalDisplayName(entry.displayName) ?? undefined } : {}),
    ...(normalizeOptionalRef(entry.avatar) ? { avatar: normalizeOptionalRef(entry.avatar) ?? undefined } : {})
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDisplayName(value: unknown): string | null {
  return normalizeOptionalString(value);
}

function normalizeOptionalRef(value: unknown): string | null {
  return normalizeOptionalString(value);
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

function materializeAgentAvatar(params: {
  avatar?: string;
  homeDirectory: string;
  agentId: string;
  displayName: string;
}): string {
  const avatar = normalizeOptionalString(params.avatar);
  if (!avatar) {
    const fileName = "avatar.svg";
    writeFileSync(
      join(params.homeDirectory, fileName),
      buildDefaultAgentAvatarSvg(params.agentId, params.displayName),
      "utf-8"
    );
    return `home://${fileName}`;
  }
  if (isRemoteAvatarRef(avatar)) {
    return avatar;
  }
  return copyLocalAvatarToHome(params.homeDirectory, avatar);
}

function isRemoteAvatarRef(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function copyLocalAvatarToHome(homeDirectory: string, avatarPath: string): string {
  const sourcePath = resolve(expandHome(avatarPath));
  if (!existsSync(sourcePath)) {
    throw new Error(`avatar file not found: ${avatarPath}`);
  }
  const sourceStats = statSync(sourcePath);
  if (!sourceStats.isFile()) {
    throw new Error(`avatar path is not a file: ${avatarPath}`);
  }
  const ext = extname(sourcePath).toLowerCase() || ".png";
  const fileName = `avatar${ext}`;
  copyFileSync(sourcePath, join(homeDirectory, fileName));
  return `home://${fileName}`;
}

function buildDefaultAgentAvatarSvg(agentId: string, displayName: string): string {
  const palette = [
    ["#F59E0B", "#B45309"],
    ["#10B981", "#047857"],
    ["#3B82F6", "#1D4ED8"],
    ["#EF4444", "#B91C1C"],
    ["#8B5CF6", "#6D28D9"],
    ["#14B8A6", "#0F766E"]
  ] as const;
  const index = Math.abs(hashText(agentId)) % palette.length;
  const [bg, fg] = palette[index] ?? palette[0];
  const letter = resolveAvatarLetter(displayName || agentId);
  return [
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\" viewBox=\"0 0 256 256\" role=\"img\" aria-label=\"avatar\">",
    `  <rect width=\"256\" height=\"256\" rx=\"64\" fill=\"${bg}\" />`,
    `  <text x=\"128\" y=\"146\" text-anchor=\"middle\" font-family=\"Arial, sans-serif\" font-size=\"104\" font-weight=\"700\" fill=\"${fg}\">${escapeXml(letter)}</text>`,
    "</svg>"
  ].join("\n");
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function resolveAvatarLetter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "A";
  }
  return trimmed.slice(0, 1).toUpperCase();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function resolveAgentAvatarHomePath(params: {
  homeDirectory: string;
  avatarRef: string;
}): string {
  const normalizedRef = normalizeOptionalString(params.avatarRef);
  if (!normalizedRef?.startsWith("home://")) {
    throw new Error("avatar ref must use home://");
  }
  const relativePath = normalizedRef.slice("home://".length).trim();
  if (!relativePath) {
    throw new Error("avatar ref must not be empty");
  }
  const targetPath = resolve(params.homeDirectory, relativePath);
  const normalizedHome = normalize(resolve(params.homeDirectory));
  const normalizedTarget = normalize(targetPath);
  if (
    normalizedTarget !== normalizedHome &&
    !normalizedTarget.startsWith(`${normalizedHome}/`) &&
    !normalizedTarget.startsWith(`${normalizedHome}\\`)
  ) {
    throw new Error("avatar ref escapes agent home directory");
  }
  return targetPath;
}

export function readAgentAvatarContent(params: {
  config: Config;
  agentId: string;
}): { bytes: Uint8Array; mimeType: string } | null {
  const assetPath = resolveAgentAvatarAssetPath(params.config, params.agentId);
  if (!assetPath || !existsSync(assetPath)) {
    return null;
  }
  const bytes = readFileSync(assetPath);
  return {
    bytes,
    mimeType: guessImageMimeType(assetPath)
  };
}

export function guessImageMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  return "application/octet-stream";
}
