import type { ProviderConfig, ProviderSpec } from "@nextclaw/core";

export function createDefaultProviderConfig(
  defaultWireApi: "auto" | "chat" | "responses" = "auto",
  defaultModels: string[] = []
): ProviderConfig {
  return {
    enabled: true,
    displayName: "",
    apiKey: "",
    apiBase: null,
    extraHeaders: null,
    wireApi: defaultWireApi,
    models: [...defaultModels],
    modelThinking: {}
  };
}

export function createDefaultProviderConfigFromSpec(spec: ProviderSpec | undefined): ProviderConfig {
  return createDefaultProviderConfig(spec?.defaultWireApi ?? "auto", spec?.defaultModels ?? []);
}
