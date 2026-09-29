import type { Config } from "@core/features/config/configs/config-schema.config.js";
import { normalizeOptionalString, toRecord } from "./agent-profile-runtime-fields.utils.js";

type AgentProfile = Config["agents"]["list"][number];
export type AgentHomeResolver = (config: Config, agentId: string) => string;

export const BUILTIN_MAIN_AGENT_ID = "main";

export type EffectiveAgentProfile = AgentProfile & {
  id: string;
  workspace: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown>;
  builtIn?: boolean;
};

export function normalizeAgentProfileId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

export function resolveConfiguredAgentProfiles(config: Config, resolveHome: AgentHomeResolver): EffectiveAgentProfile[] {
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
      engine: normalizeOptionalString(mainOverride?.engine) ?? normalizeOptionalString(config.agents.defaults.engine) ?? undefined,
      engineConfig: toRecord(mainOverride?.engineConfig) ?? toRecord(config.agents.defaults.engineConfig),
      runtime: normalizeOptionalString(mainOverride?.engine) ?? normalizeOptionalString(config.agents.defaults.engine) ?? undefined,
      runtimeConfig: toRecord(mainOverride?.engineConfig) ?? toRecord(config.agents.defaults.engineConfig),
      thinkingDefault: mainOverride?.thinkingDefault,
      models: mainOverride?.models,
      contextTokens: mainOverride?.contextTokens,
      reservedContextTokens: mainOverride?.reservedContextTokens,
      builtIn: true
    },
    ...extraAgents
      .map((entry) => projectConfiguredAgentProfile(entry, config, resolveHome))
      .filter((entry): entry is EffectiveAgentProfile => Boolean(entry))
  ];
}

export function projectConfiguredAgentProfile(entry: AgentProfile, config: Config, resolveHome: AgentHomeResolver): EffectiveAgentProfile | null {
  const id = normalizeAgentProfileId(entry.id);
  if (!id) {
    return null;
  }
  return {
    ...entry,
    id,
    workspace: normalizeOptionalString(entry.workspace) ?? resolveHome(config, id),
    ...(normalizeOptionalString(entry.displayName) ? { displayName: normalizeOptionalString(entry.displayName) ?? undefined } : {}),
    ...(normalizeOptionalString(entry.description) ? { description: normalizeOptionalString(entry.description) ?? undefined } : {}),
    ...(normalizeOptionalString(entry.avatar) ? { avatar: normalizeOptionalString(entry.avatar) ?? undefined } : {}),
    ...(normalizeOptionalString(entry.engine) ? { runtime: normalizeOptionalString(entry.engine) ?? undefined } : {}),
    ...(toRecord(entry.engineConfig) ? { runtimeConfig: toRecord(entry.engineConfig) } : {})
  };
}
