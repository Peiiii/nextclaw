import type { ProviderConfig } from "@nextclaw/core";

export function createDefaultProviderConfig(defaultWireApi: "auto" | "chat" | "responses" = "auto"): ProviderConfig {
  return {
    enabled: true,
    displayName: "",
    apiKey: "",
    apiBase: null,
    extraHeaders: null,
    wireApi: defaultWireApi,
    models: [],
    modelThinking: {}
  };
}
