import { getProviderName, type Config } from "../config/schema.js";
import {
  parseThinkingLevel,
  resolveEffectiveThinkingLevel,
  resolveModelThinkingCapability,
  type ThinkingLevel
} from "../utils/thinking.js";

type ModelStrategyMap = Record<string, { params: Record<string, unknown> }>;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeModelKey(value: string): string {
  return value.trim().toLowerCase();
}

function findAgentProfile(config: Config, agentId: string | null | undefined): Config["agents"]["list"][number] | undefined {
  const normalizedId = normalizeText(agentId).toLowerCase();
  if (!normalizedId) {
    return undefined;
  }
  return config.agents.list.find((entry) => normalizeText(entry.id).toLowerCase() === normalizedId);
}

function readModelLevel(models: ModelStrategyMap | undefined, model: string): ThinkingLevel | null {
  if (!models) {
    return null;
  }
  const normalizedModel = normalizeModelKey(model);
  for (const [rawKey, rawEntry] of Object.entries(models)) {
    if (normalizeModelKey(rawKey) !== normalizedModel) {
      continue;
    }
    const params = rawEntry?.params;
    const parsed = parseThinkingLevel(params?.thinking);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

export function resolveThinkingLevel(params: {
  config?: Config | null;
  agentId?: string | null;
  model?: string | null;
  sessionThinkingLevel?: ThinkingLevel | null;
}): ThinkingLevel {
  const sessionLevel = parseThinkingLevel(params.sessionThinkingLevel);
  if (sessionLevel) {
    return applyModelCapabilityPolicy({
      requestedLevel: sessionLevel,
      config: params.config ?? null,
      model: normalizeText(params.model)
    });
  }

  const config = params.config ?? null;
  if (!config) {
    return "off";
  }

  const model = normalizeText(params.model) || normalizeText(config.agents.defaults.model);
  const agentProfile = findAgentProfile(config, params.agentId);

  if (model) {
    const agentModelLevel = readModelLevel(agentProfile?.models, model);
    if (agentModelLevel) {
      return applyModelCapabilityPolicy({
        requestedLevel: agentModelLevel,
        config,
        model
      });
    }
    const globalModelLevel = readModelLevel(config.agents.defaults.models, model);
    if (globalModelLevel) {
      return applyModelCapabilityPolicy({
        requestedLevel: globalModelLevel,
        config,
        model
      });
    }
  }

  const agentDefaultLevel = parseThinkingLevel(agentProfile?.thinkingDefault);
  if (agentDefaultLevel) {
    return applyModelCapabilityPolicy({
      requestedLevel: agentDefaultLevel,
      config,
      model
    });
  }

  const globalDefaultLevel = parseThinkingLevel(config.agents.defaults.thinkingDefault);
  if (globalDefaultLevel) {
    return applyModelCapabilityPolicy({
      requestedLevel: globalDefaultLevel,
      config,
      model
    });
  }

  return "off";
}

function applyModelCapabilityPolicy(params: {
  requestedLevel: ThinkingLevel;
  config: Config | null;
  model: string;
}): ThinkingLevel {
  if (!params.config) {
    return params.requestedLevel;
  }
  const model = normalizeText(params.model);
  if (!model) {
    return params.requestedLevel;
  }
  const providerName = getProviderName(params.config, model);
  if (!providerName) {
    return params.requestedLevel;
  }
  const provider = params.config.providers[providerName];
  const capability = resolveModelThinkingCapability({
    model,
    providerName,
    capabilities: provider?.modelThinking
  });
  return resolveEffectiveThinkingLevel(params.requestedLevel, capability);
}
