export type SessionTypeDescriptor = {
  icon?: {
    kind: "image";
    src: string;
    alt?: string | null;
  } | null;
  ready?: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  cta?: {
    kind: string;
    label?: string;
    href?: string;
  } | null;
};

const CODEX_RUNTIME_ICON_URI = "app://runtime-icons/codex-openai.svg";

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function resolveConfiguredCodexModels(
  pluginConfig: Record<string, unknown>,
): string[] | undefined {
  const explicitSupportedModels = readStringArray(pluginConfig.supportedModels);
  if (!explicitSupportedModels) {
    return undefined;
  }
  const normalizedModels = dedupeStrings(explicitSupportedModels);
  if (normalizedModels.includes("*")) {
    return undefined;
  }
  return normalizedModels;
}

function resolveRecommendedCodexModel(params: {
  defaultModel?: string;
  pluginConfig: Record<string, unknown>;
  supportedModels?: string[];
}): string | null {
  const configuredModel = readString(params.pluginConfig.model) ?? params.defaultModel;
  if (!configuredModel) {
    return params.supportedModels?.[0] ?? null;
  }
  if (!params.supportedModels || params.supportedModels.includes(configuredModel)) {
    return configuredModel;
  }
  return params.supportedModels[0] ?? configuredModel ?? null;
}

export function createDescribeCodexSessionType(params: {
  defaultModel?: string;
  pluginConfig: Record<string, unknown>;
}): () => SessionTypeDescriptor {
  return () => {
    const supportedModels = resolveConfiguredCodexModels(params.pluginConfig);
    const descriptor: SessionTypeDescriptor = {
      icon: {
        kind: "image",
        src: CODEX_RUNTIME_ICON_URI,
        alt: "Codex",
      },
      ready: true,
      reason: null,
      reasonMessage: null,
      recommendedModel: resolveRecommendedCodexModel({
        defaultModel: params.defaultModel,
        pluginConfig: params.pluginConfig,
        supportedModels,
      }),
      cta: null,
    };
    if (supportedModels) {
      descriptor.supportedModels = supportedModels;
    }
    return descriptor;
  };
}
