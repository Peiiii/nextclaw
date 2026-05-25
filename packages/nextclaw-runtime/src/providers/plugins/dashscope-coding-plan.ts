import type { ProviderSpec } from "@nextclaw/core";

export const dashscopeCodingPlanProviderSpec: ProviderSpec = {
  name: "dashscope-coding-plan",
  keywords: ["dashscope-coding-plan", "coding-plan"],
  envKey: "DASHSCOPE_CODING_PLAN_API_KEY",
  displayName: "DashScope Coding Plan",
  modelPrefix: "dashscope-coding-plan",
  litellmPrefix: "dashscope-coding-plan",
  skipPrefixes: ["dashscope-coding-plan/"],
  envExtras: [],
  isGateway: false,
  isLocal: false,
  detectByKeyPrefix: "sk-sp-",
  detectByBaseKeyword: "coding.dashscope.aliyuncs.com",
  defaultApiBase: "https://coding.dashscope.aliyuncs.com/v1",
  defaultModels: [
    "dashscope-coding-plan/qwen3.5-plus",
    "dashscope-coding-plan/qwen3-max-2026-01-23",
    "dashscope-coding-plan/qwen3-coder-next",
    "dashscope-coding-plan/qwen3-coder-plus",
    "dashscope-coding-plan/MiniMax-M2.5",
    "dashscope-coding-plan/glm-5",
    "dashscope-coding-plan/glm-4.7",
    "dashscope-coding-plan/kimi-k2.5"
  ],
  modelConfig: {
    "dashscope-coding-plan/qwen3.5-plus": { vision: true },
    "dashscope-coding-plan/kimi-k2.5": { vision: true }
  },
  stripModelPrefix: false,
  modelOverrides: [],
  supportsResponsesApi: false,
  logo: "dashscope.png",
  apiBaseHelp: {
    zh: "Coding Plan 必须使用专属 Base URL https://coding.dashscope.aliyuncs.com/v1，并配合 sk-sp- 开头的专属 API Key；不要与普通 DashScope 按量计费 Key/Base URL 混用。",
    en: "Coding Plan must use the dedicated base URL https://coding.dashscope.aliyuncs.com/v1 together with an sk-sp- API key. Do not mix it with the regular DashScope pay-as-you-go key/base URL."
  }
};
