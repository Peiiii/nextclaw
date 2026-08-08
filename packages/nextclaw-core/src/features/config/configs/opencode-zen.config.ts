export const OPENCODE_ZEN_PROVIDER_ID = "opencode";
export const OPENCODE_ZEN_PUBLIC_API_KEY = "public";
export const OPENCODE_ZEN_API_BASE = "https://opencode.ai/zen/v1";
export const OPENCODE_ZEN_DEFAULT_MODEL = "opencode/big-pickle";

export const OPENCODE_ZEN_FREE_MODELS = [
  "opencode/big-pickle",
  "opencode/deepseek-v4-flash-free",
  "opencode/mimo-v2.5-free",
  "opencode/laguna-s-2.1-free",
  "opencode/longcat-2.0-free",
  "opencode/north-mini-code-free",
  "opencode/nemotron-3-ultra-free"
];

export const OPENCODE_ZEN_MODEL_CONFIG = {
  "opencode/mimo-v2.5-free": { vision: true }
};

export const OPENCODE_ZEN_UNAVAILABLE_FREE_MODELS = [
  "opencode/ling-3.0-flash-free"
] as const;

export const OPENCODE_ZEN_FRESH_INSTALL_PROVIDER_CONFIG = {
  enabled: true,
  providerType: OPENCODE_ZEN_PROVIDER_ID,
  displayName: "",
  apiKey: "",
  apiBase: OPENCODE_ZEN_API_BASE,
  extraHeaders: null,
  wireApi: "chat" as const,
  models: OPENCODE_ZEN_FREE_MODELS,
  modelConfig: OPENCODE_ZEN_MODEL_CONFIG
};
