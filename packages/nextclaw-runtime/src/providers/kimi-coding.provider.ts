import type { ProviderSpec } from "@nextclaw/core";

export const kimiCodingProviderSpec: ProviderSpec = {
  name: "kimi-coding",
  keywords: ["kimi-coding", "kimi-code", "kimi-for-coding"],
  envKey: "KIMI_CODING_API_KEY",
  displayName: "Kimi Coding",
  apiProtocol: "anthropic-messages",
  modelPrefix: "kimi-coding",
  defaultModels: ["kimi-coding/kimi-for-coding"],
  defaultHeaders: {
    "User-Agent": "claude-code/0.1.0",
  },
  envExtras: [],
  isGateway: false,
  isLocal: false,
  detectByKeyPrefix: "",
  detectByBaseKeyword: "api.kimi.com/coding",
  defaultApiBase: "https://api.kimi.com/coding",
  stripModelPrefix: false,
  modelOverrides: [],
  logo: "moonshot.png",
  apiBaseHelp: {
    zh: "Kimi Coding 需要使用专属 Base URL https://api.kimi.com/coding，并通过 Anthropic Messages 协议访问。",
    en: "Kimi Coding requires the dedicated base URL https://api.kimi.com/coding and uses the Anthropic Messages protocol.",
  },
};
