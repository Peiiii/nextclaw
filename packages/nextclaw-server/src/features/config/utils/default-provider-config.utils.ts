import { normalizeProviderModelConfig, type ProviderConfig, type ProviderSpec } from "@nextclaw/core";

export function createDefaultProviderConfig(
  defaultWireApi: "auto" | "chat" | "responses" = "auto",
  defaultModels: string[] = [],
  modelConfig: ProviderConfig["modelConfig"] = {},
  providerType?: string | null
): ProviderConfig {
  return {
    enabled: true,
    providerType,
    displayName: "",
    apiKey: "",
    apiBase: null,
    extraHeaders: null,
    wireApi: defaultWireApi,
    models: [...defaultModels],
    modelConfig
  };
}

export function createDefaultProviderConfigFromSpec(spec: ProviderSpec | undefined): ProviderConfig {
  return createDefaultProviderConfig(
    spec?.defaultWireApi ?? "auto",
    spec?.defaultModels ?? [],
    normalizeProviderModelConfig(spec?.modelConfig ?? {}),
    spec?.name
  );
}
