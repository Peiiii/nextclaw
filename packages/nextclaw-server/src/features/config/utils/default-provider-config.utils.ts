import { normalizeProviderModelConfig, type ProviderConfig, type ProviderSpec } from "@nextclaw/core";

export function createDefaultProviderConfig(
  defaultWireApi: "auto" | "chat" | "responses" = "auto",
  defaultModels: string[] = [],
  modelConfig: ProviderConfig["modelConfig"] = {}
): ProviderConfig {
  return {
    enabled: true,
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
    normalizeProviderModelConfig(spec?.modelConfig ?? {})
  );
}
