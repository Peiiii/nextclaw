import {
  findProviderByName,
  getProvider,
  getProviderName,
  type Config,
  type ProviderConfig,
  type ProviderSpec,
} from "@nextclaw/core";
import { dedupeStrings, readString, readStringArray } from "./claude-runtime-shared.utils.js";

export type ClaudeProviderRouteKind = "anthropic-direct" | "anthropic-gateway";

export type ClaudeProviderRoute = {
  kind: ClaudeProviderRouteKind;
  providerName: string;
  providerLabel: string;
  configuredModels: string[];
  runtimeModel: string;
  apiBase?: string;
  apiKey?: string;
  authToken?: string;
};

export type ClaudeProviderRoutingResult = {
  route: ClaudeProviderRoute | null;
  modelInput: string;
  runtimeModel: string;
  configuredModels: string[];
  recommendedModel: string | null;
  recommendedRuntimeModel: string | null;
  reason?: string;
  reasonMessage?: string;
};

export type ClaudeProviderRouteCandidate = ClaudeProviderRoute;

type ProviderCandidate = {
  routeKind: ClaudeProviderRouteKind;
  providerName: string;
  providerLabel: string;
  configuredModels: string[];
  apiBase?: string;
  apiKey?: string;
  authToken?: string;
  aliases: string[];
};

const BUILTIN_ANTHROPIC_COMPATIBLE_PROVIDER_NAMES = new Set([
  "anthropic",
  "minimax",
  "minimax-portal",
  "zhipu",
]);

const FALLBACK_PROVIDER_SPECS: Record<string, Partial<ProviderSpec>> = {
  aihubmix: {
    displayName: "AiHubMix",
    modelPrefix: "aihubmix",
    defaultApiBase: "https://aihubmix.com/v1",
  },
  anthropic: {
    displayName: "Anthropic",
    modelPrefix: "anthropic",
    defaultApiBase: "https://api.anthropic.com",
    defaultModels: ["anthropic/claude-opus-4-6", "anthropic/claude-sonnet-4-6"],
  },
  dashscope: {
    displayName: "DashScope",
    modelPrefix: "dashscope",
    defaultApiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  deepseek: {
    displayName: "DeepSeek",
    modelPrefix: "deepseek",
    defaultApiBase: "https://api.deepseek.com",
  },
  gemini: {
    displayName: "Gemini",
    modelPrefix: "gemini",
    defaultApiBase: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  minimax: {
    displayName: "MiniMax",
    modelPrefix: "minimax",
    defaultApiBase: "https://api.minimaxi.com/v1",
    defaultModels: [
      "minimax/MiniMax-M2.7",
      "minimax/MiniMax-M2.7-highspeed",
      "minimax/MiniMax-M2.5",
      "minimax/MiniMax-M2.5-highspeed",
    ],
  },
  "minimax-portal": {
    displayName: "MiniMax Portal",
    modelPrefix: "minimax-portal",
    defaultApiBase: "https://api.minimaxi.com/v1",
    defaultModels: ["minimax-portal/MiniMax-M2.5", "minimax-portal/MiniMax-M2.5-highspeed"],
  },
  moonshot: {
    displayName: "Moonshot",
    modelPrefix: "moonshot",
    defaultApiBase: "https://api.moonshot.ai/v1",
  },
  openai: {
    displayName: "OpenAI",
    modelPrefix: "openai",
    defaultApiBase: "https://api.openai.com/v1",
  },
  openrouter: {
    displayName: "OpenRouter",
    modelPrefix: "openrouter",
    defaultApiBase: "https://openrouter.ai/api/v1",
  },
  "qwen-portal": {
    displayName: "Qwen Portal",
    modelPrefix: "qwen-portal",
    defaultApiBase: "https://portal.qwen.ai/v1",
  },
  zhipu: {
    displayName: "Zhipu AI",
    modelPrefix: "zai",
    defaultApiBase: "https://open.bigmodel.cn/api/paas/v4",
    defaultModels: ["zai/glm-5"],
  },
};

function resolveProviderSpec(providerName: string): ProviderSpec | undefined {
  const registrySpec = findProviderByName(providerName);
  if (registrySpec) {
    return registrySpec;
  }
  const fallbackSpec = FALLBACK_PROVIDER_SPECS[providerName];
  return fallbackSpec ? (fallbackSpec as ProviderSpec) : undefined;
}

function normalizeApiBase(apiBase: string | undefined): string | undefined {
  const value = readString(apiBase);
  if (!value) {
    return undefined;
  }
  return value.replace(/\/+$/, "");
}

function joinProviderPath(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`;
}

function toAnthropicCompatibleApiBase(params: {
  providerName: string;
  apiBase?: string;
}): string | undefined {
  const { apiBase, providerName } = params;
  const normalizedBase = normalizeApiBase(apiBase);
  if (!normalizedBase) {
    return undefined;
  }
  if (providerName === "minimax" || providerName === "minimax-portal") {
    if (normalizedBase.endsWith("/anthropic")) {
      return normalizedBase;
    }
    const withoutV1 = normalizedBase.replace(/\/v1$/i, "");
    return joinProviderPath(withoutV1, "anthropic");
  }
  if (providerName === "zhipu") {
    if (normalizedBase.endsWith("/api/anthropic") || normalizedBase.endsWith("/anthropic")) {
      return normalizedBase;
    }
    const replaced = normalizedBase.replace(/\/api\/paas\/v4$/i, "/api/anthropic");
    if (replaced !== normalizedBase) {
      return replaced;
    }
    try {
      const url = new URL(normalizedBase);
      return `${url.origin}/api/anthropic`;
    } catch {
      return joinProviderPath(normalizedBase, "api/anthropic");
    }
  }
  return normalizedBase;
}

function normalizeProviderAliases(providerName: string, providerSpec?: ProviderSpec): string[] {
  return dedupeStrings([providerSpec?.modelPrefix ?? "", providerName]);
}

function toProviderLocalModel(model: string, aliases: string[]): string | undefined {
  const normalized = readString(model);
  if (!normalized) {
    return undefined;
  }
  for (const alias of aliases) {
    if (!alias) {
      continue;
    }
    if (normalized === alias) {
      return undefined;
    }
    if (normalized.startsWith(`${alias}/`)) {
      return normalized.slice(alias.length + 1).trim() || undefined;
    }
  }
  return normalized;
}

function composeProviderModel(localModel: string, providerPrefix: string): string {
  const normalizedLocalModel = localModel.trim();
  const normalizedPrefix = providerPrefix.trim();
  if (!normalizedPrefix) {
    return normalizedLocalModel;
  }
  return `${normalizedPrefix}/${normalizedLocalModel}`;
}

function readConfiguredProviderModels(params: {
  providerName: string;
  provider: ProviderConfig | null;
  providerSpec?: ProviderSpec;
}): string[] {
  const { provider, providerName, providerSpec } = params;
  const prefix = readString(providerSpec?.modelPrefix) ?? providerName;
  const aliases = normalizeProviderAliases(providerName, providerSpec);
  const providerModels =
    provider && Array.isArray(provider.models) ? provider.models : [];
  const defaultModels = providerSpec?.defaultModels ?? [];
  const localModels = dedupeStrings(
    [...defaultModels, ...providerModels]
      .map((model) => toProviderLocalModel(String(model), aliases))
      .filter((model): model is string => Boolean(model)),
  );
  return localModels.map((localModel) => composeProviderModel(localModel, prefix));
}

function stripProviderModelPrefix(model: string, aliases: string[]): string {
  const normalized = model.trim();
  for (const alias of aliases) {
    if (!alias) {
      continue;
    }
    if (normalized.startsWith(`${alias}/`)) {
      return normalized.slice(alias.length + 1);
    }
  }
  return normalized;
}

function resolveConfiguredCandidateModels(params: {
  modelInput: string;
  candidate: ProviderCandidate;
}): string[] {
  if (params.candidate.configuredModels.length > 0) {
    return params.candidate.configuredModels;
  }

  const normalizedInput = readString(params.modelInput);
  if (!normalizedInput) {
    return [];
  }
  return [normalizedInput];
}

function createProviderCandidate(params: {
  providerName: string;
  provider: ProviderConfig | null;
  providerSpec?: ProviderSpec;
  routeKind: ClaudeProviderRouteKind;
}): ProviderCandidate | null {
  const { provider, providerName, providerSpec, routeKind } = params;
  const apiKey = readString(provider?.apiKey);
  if (!apiKey) {
    return null;
  }

  const apiBase = toAnthropicCompatibleApiBase({
    providerName,
    apiBase:
      normalizeApiBase(readString(provider?.apiBase)) ??
      normalizeApiBase(readString(providerSpec?.defaultApiBase)),
  });
  if (!apiBase && providerName !== "anthropic") {
    return null;
  }
  const configuredModels = readConfiguredProviderModels({
    providerName,
    provider,
    providerSpec,
  });
  const aliases = normalizeProviderAliases(providerName, providerSpec);
  const providerLabel =
    readString(provider?.displayName) ??
    readString(providerSpec?.displayName) ??
    providerName;

  if (routeKind === "anthropic-direct") {
    if (providerName === "anthropic") {
      return {
        routeKind,
        providerName,
        providerLabel,
        configuredModels,
        apiBase,
        apiKey,
        aliases,
      };
    }
    return {
      routeKind,
      providerName,
      providerLabel,
      configuredModels,
      apiBase,
      apiKey,
      authToken: apiKey,
      aliases,
    };
  }

  return {
    routeKind,
    providerName,
    providerLabel,
    configuredModels,
    apiBase,
    apiKey,
    authToken: apiKey,
    aliases,
  };
}

function findCompatibleProviderCandidates(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): ProviderCandidate[] {
  const { config, pluginConfig } = params;
  const configuredProviders =
    config.providers && typeof config.providers === "object" && !Array.isArray(config.providers)
      ? (config.providers as Record<string, ProviderConfig>)
      : {};
  const anthropicCompatibleProviderNames = new Set([
    ...BUILTIN_ANTHROPIC_COMPATIBLE_PROVIDER_NAMES,
    ...(readStringArray(pluginConfig.anthropicCompatibleProviderNames) ?? []),
  ]);
  const gatewayProviderNames = new Set(readStringArray(pluginConfig.gatewayProviderNames) ?? []);
  const candidates: ProviderCandidate[] = [];

  for (const providerName of Object.keys(configuredProviders)) {
    const provider = configuredProviders[providerName];
    const providerSpec = resolveProviderSpec(providerName);
    const routeKind =
      providerName === "anthropic" || anthropicCompatibleProviderNames.has(providerName)
        ? "anthropic-direct"
        : gatewayProviderNames.has(providerName)
          ? "anthropic-gateway"
          : "anthropic-gateway";
    const candidate = createProviderCandidate({
      providerName,
      provider,
      providerSpec,
      routeKind,
    });
    if (!candidate) {
      continue;
    }
    candidates.push(candidate);
  }

  return candidates;
}

function buildRouteFromCandidate(params: {
  candidate: ProviderCandidate;
  modelInput: string;
}): ClaudeProviderRoute {
  const { candidate, modelInput } = params;
  return {
    kind: candidate.routeKind,
    providerName: candidate.providerName,
    providerLabel: candidate.providerLabel,
    configuredModels: resolveConfiguredCandidateModels({
      modelInput,
      candidate,
    }),
    runtimeModel: stripProviderModelPrefix(modelInput, candidate.aliases),
    apiBase: candidate.apiBase,
    apiKey: candidate.apiKey,
    authToken: candidate.authToken,
  };
}

function matchCandidateForModel(params: {
  config: Config;
  modelInput: string;
  candidates: ProviderCandidate[];
}): ProviderCandidate | null {
  const { config, modelInput, candidates } = params;
  const providerName = getProviderName(config, modelInput);
  if (!providerName) {
    return null;
  }

  for (const candidate of candidates) {
    if (candidate.providerName !== providerName) {
      continue;
    }
    const configuredModels = resolveConfiguredCandidateModels({
      modelInput,
      candidate,
    });
    if (configuredModels.length === 0 || configuredModels.includes(modelInput)) {
      return candidate;
    }
  }

  return null;
}

function resolveUnsupportedReason(params: {
  config: Config;
  modelInput: string;
  candidates: ProviderCandidate[];
}): {
  reason?: string;
  reasonMessage?: string;
} {
  const { candidates, config, modelInput } = params;
  const providerName = getProviderName(config, modelInput);
  const provider = getProvider(config, modelInput);
  if (!providerName) {
    return candidates.length > 0
      ? {
          reason: "model_unsupported",
          reasonMessage:
            "The current Claude model selection does not resolve to a configured provider/model pair. Switch to one of the configured Claude models first.",
        }
      : {
          reason: "api_key_missing",
          reasonMessage:
            "Claude in NextClaw requires either Claude auth or at least one configured provider credential that can be routed as an Anthropic-compatible gateway.",
        };
  }

  if (!readString(provider?.apiKey)) {
    return {
      reason: "api_key_missing",
      reasonMessage: `Provider "${providerName}" is selected for Claude, but it does not have an API credential configured yet.`,
    };
  }

  const providerSpec = resolveProviderSpec(providerName);
  const inferredApiBase = toAnthropicCompatibleApiBase({
    providerName,
    apiBase:
      normalizeApiBase(readString(provider?.apiBase)) ??
      normalizeApiBase(readString(providerSpec?.defaultApiBase)),
  });
  if (!inferredApiBase && providerName !== "anthropic") {
    return {
      reason: "api_base_missing",
      reasonMessage: `Provider "${providerName}" has a credential, but Claude routing cannot infer an Anthropic-compatible API base for it yet. Configure providers.${providerName}.apiBase explicitly first.`,
    };
  }

  return {
    reason: "provider_unsupported",
    reasonMessage: `Provider "${providerName}" could not be routed for Claude yet. Verify its credential and Anthropic-compatible API base configuration.`,
  };
}

export function resolveClaudeProviderRouting(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  modelInput: string;
  allowRecommendedFallback: boolean;
}): ClaudeProviderRoutingResult {
  const { allowRecommendedFallback, config, pluginConfig } = params;
  const modelInput = readString(params.modelInput) ?? config.agents.defaults.model;
  const candidates = findCompatibleProviderCandidates({
    config,
    pluginConfig,
  });
  const selectedCandidate = matchCandidateForModel({
    config,
    modelInput,
    candidates,
  });
  const recommendedRoute =
    !selectedCandidate && allowRecommendedFallback && candidates.length > 0
      ? buildRouteFromCandidate({
          candidate: candidates[0],
          modelInput: candidates[0].configuredModels[0] ?? modelInput,
        })
      : null;
  const selectedRoute =
    selectedCandidate !== null
      ? buildRouteFromCandidate({
          candidate: selectedCandidate,
          modelInput,
        })
      : null;
  const route = selectedRoute ?? recommendedRoute;
  const configuredModels = dedupeStrings([
    ...candidates.flatMap((candidate) => candidate.configuredModels),
    ...(selectedRoute?.configuredModels ?? []),
    ...(recommendedRoute?.configuredModels ?? []),
  ]);
  const recommendedModel = selectedRoute?.configuredModels.includes(modelInput)
    ? modelInput
    : selectedRoute?.configuredModels[0] ??
      recommendedRoute?.configuredModels[0] ??
      configuredModels[0] ??
      null;
  const recommendedRuntimeModel = selectedRoute?.configuredModels.includes(modelInput)
    ? selectedRoute.runtimeModel
    : selectedCandidate
      ? buildRouteFromCandidate({
          candidate: selectedCandidate,
          modelInput: selectedCandidate.configuredModels[0] ?? modelInput,
        }).runtimeModel
      : recommendedRoute?.runtimeModel ?? recommendedModel;

  if (route) {
    return {
      route,
      modelInput: selectedRoute?.configuredModels.includes(modelInput)
        ? modelInput
        : route.configuredModels[0] ?? modelInput,
      runtimeModel: route.runtimeModel,
      configuredModels,
      recommendedModel,
      recommendedRuntimeModel,
    };
  }

  const unsupportedReason = resolveUnsupportedReason({
    config,
    modelInput,
    candidates,
  });

  return {
    route: null,
    modelInput,
    runtimeModel: modelInput,
    configuredModels,
    recommendedModel,
    recommendedRuntimeModel: recommendedModel,
    ...unsupportedReason,
  };
}

export function listClaudeProviderRouteCandidates(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): ClaudeProviderRouteCandidate[] {
  const candidates = findCompatibleProviderCandidates({
    config: params.config,
    pluginConfig: params.pluginConfig,
  });

  return candidates.map((candidate) =>
    buildRouteFromCandidate({
      candidate,
      modelInput: candidate.configuredModels[0] ?? candidate.providerName,
    }),
  );
}
