import {
  OPENCODE_ZEN_API_BASE,
  OPENCODE_ZEN_FREE_MODELS,
  OPENCODE_ZEN_MODEL_CONFIG,
  OPENCODE_ZEN_PUBLIC_API_KEY,
  OPENCODE_ZEN_PROVIDER_ID,
  type ProviderSpec
} from "@nextclaw/core";

export const opencodeZenProviderSpec: ProviderSpec = {
  name: OPENCODE_ZEN_PROVIDER_ID,
  keywords: ["opencode", "big-pickle"],
  envKey: "OPENCODE_API_KEY",
  displayName: "OpenCode Zen Free Trial",
  modelPrefix: OPENCODE_ZEN_PROVIDER_ID,
  litellmPrefix: OPENCODE_ZEN_PROVIDER_ID,
  skipPrefixes: [],
  envExtras: [],
  isGateway: true,
  isLocal: false,
  detectByKeyPrefix: "",
  detectByBaseKeyword: "opencode.ai/zen",
  defaultApiBase: OPENCODE_ZEN_API_BASE,
  anonymousApiKey: OPENCODE_ZEN_PUBLIC_API_KEY,
  defaultModels: [...OPENCODE_ZEN_FREE_MODELS],
  modelConfig: { ...OPENCODE_ZEN_MODEL_CONFIG },
  modelDiscovery: {
    kind: "models-dev",
    url: "https://models.opencode.ai/api.json",
    providerId: OPENCODE_ZEN_PROVIDER_ID,
    freeOnly: true,
  },
  stripModelPrefix: false,
  modelOverrides: [],
  supportsWireApi: true,
  wireApiOptions: ["chat"],
  defaultWireApi: "chat",
  supportsResponsesApi: false,
  apiBaseHelp: {
    zh: "免费试用通过 OpenCode Zen 公共网关提供，限额和模型可能变化；请求数据可能被用于改进模型，请勿发送敏感或机密信息。",
    en: "Free trial access uses OpenCode Zen's public gateway. Limits and models may change, and request data may be used to improve models. Do not send sensitive or confidential information."
  }
};
