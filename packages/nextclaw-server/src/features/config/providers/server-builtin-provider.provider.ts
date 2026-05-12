import type { ProviderSpec } from "@nextclaw/core";
import { findBuiltinProviderByName, listBuiltinProviders } from "@nextclaw/runtime";

const MINIMAX_PORTAL_PROVIDER_SPEC: ProviderSpec = {
  name: "minimax-portal",
  keywords: ["minimax-portal", "minimax"],
  envKey: "MINIMAX_PORTAL_TOKEN",
  displayName: "MiniMax Portal",
  modelPrefix: "minimax-portal",
  litellmPrefix: "minimax-portal",
  skipPrefixes: ["minimax-portal/"],
  envExtras: [],
  isGateway: false,
  isLocal: false,
  detectByKeyPrefix: "",
  detectByBaseKeyword: "",
  defaultApiBase: "https://api.minimax.io/v1",
  defaultModels: ["minimax-portal/MiniMax-M2.5", "minimax-portal/MiniMax-M2.5-highspeed"],
  stripModelPrefix: false,
  modelOverrides: [],
  logo: "minimax.svg",
  apiBaseHelp: {
    zh: "OAuth Global 默认使用 https://api.minimax.io/v1；OAuth 中国区默认使用 https://api.minimaxi.com/v1。",
    en: "OAuth Global uses https://api.minimax.io/v1 by default; OAuth CN uses https://api.minimaxi.com/v1."
  },
  auth: {
    kind: "device_code",
    protocol: "minimax_user_code",
    displayName: "MiniMax OAuth",
    baseUrl: "https://api.minimax.io",
    deviceCodePath: "/oauth/code",
    tokenPath: "/oauth/token",
    clientId: "78257093-7e40-4613-99e0-527b14b39113",
    scope: "group_id profile model.completion",
    grantType: "urn:ietf:params:oauth:grant-type:user_code",
    usePkce: true,
    defaultMethodId: "cn",
    methods: [
      {
        id: "global",
        label: {
          zh: "Global（海外）",
          en: "Global"
        },
        hint: {
          zh: "适用于海外用户，默认 API Base 为 https://api.minimax.io/v1。",
          en: "For international users. Default API base: https://api.minimax.io/v1."
        },
        baseUrl: "https://api.minimax.io",
        defaultApiBase: "https://api.minimax.io/v1"
      },
      {
        id: "cn",
        label: {
          zh: "中国区（CN）",
          en: "China Mainland (CN)"
        },
        hint: {
          zh: "适用于中国区用户，默认 API Base 为 https://api.minimaxi.com/v1。",
          en: "For Mainland China users. Default API base: https://api.minimaxi.com/v1."
        },
        baseUrl: "https://api.minimaxi.com",
        defaultApiBase: "https://api.minimaxi.com/v1"
      }
    ],
    note: {
      zh: "通过浏览器完成 MiniMax OAuth 授权后即可使用，无需手动填写 API Key。",
      en: "Complete MiniMax OAuth in browser to use this provider without manually entering an API key."
    }
  }
};

const SERVER_BUILTIN_PROVIDER_OVERRIDES: ProviderSpec[] = [MINIMAX_PORTAL_PROVIDER_SPEC];
const SERVER_BUILTIN_PROVIDER_OVERRIDE_MAP = new Map(
  SERVER_BUILTIN_PROVIDER_OVERRIDES.map((provider) => [provider.name, provider] as const)
);

export function listServerBuiltinProviders(): ProviderSpec[] {
  const merged = new Map<string, ProviderSpec>();
  for (const provider of listBuiltinProviders()) {
    merged.set(provider.name, provider);
  }
  for (const provider of SERVER_BUILTIN_PROVIDER_OVERRIDES) {
    merged.set(provider.name, provider);
  }
  return Array.from(merged.values());
}

export function findServerBuiltinProviderByName(name: string): ProviderSpec | undefined {
  return SERVER_BUILTIN_PROVIDER_OVERRIDE_MAP.get(name) ?? findBuiltinProviderByName(name);
}
