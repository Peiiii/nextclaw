export type ProviderSpec = {
  name: string;
  keywords: string[];
  envKey: string;
  displayName?: string;
  litellmPrefix?: string;
  skipPrefixes?: string[];
  envExtras?: Array<[string, string]>;
  isGateway?: boolean;
  isLocal?: boolean;
  detectByKeyPrefix?: string;
  detectByBaseKeyword?: string;
  defaultApiBase?: string;
  stripModelPrefix?: boolean;
  modelOverrides?: Array<[string, Record<string, unknown>]>;
};

export const PROVIDERS: ProviderSpec[] = [
  {
    name: "openrouter",
    keywords: ["openrouter"],
    envKey: "OPENROUTER_API_KEY",
    displayName: "OpenRouter",
    litellmPrefix: "openrouter",
    skipPrefixes: [],
    envExtras: [],
    isGateway: true,
    isLocal: false,
    detectByKeyPrefix: "sk-or-",
    detectByBaseKeyword: "openrouter",
    defaultApiBase: "https://openrouter.ai/api/v1",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "aihubmix",
    keywords: ["aihubmix"],
    envKey: "OPENAI_API_KEY",
    displayName: "AiHubMix",
    litellmPrefix: "openai",
    skipPrefixes: [],
    envExtras: [],
    isGateway: true,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "aihubmix",
    defaultApiBase: "https://aihubmix.com/v1",
    stripModelPrefix: true,
    modelOverrides: []
  },
  {
    name: "anthropic",
    keywords: ["anthropic", "claude"],
    envKey: "ANTHROPIC_API_KEY",
    displayName: "Anthropic",
    litellmPrefix: "",
    skipPrefixes: [],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "openai",
    keywords: ["openai", "gpt"],
    envKey: "OPENAI_API_KEY",
    displayName: "OpenAI",
    litellmPrefix: "",
    skipPrefixes: [],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "deepseek",
    keywords: ["deepseek"],
    envKey: "DEEPSEEK_API_KEY",
    displayName: "DeepSeek",
    litellmPrefix: "deepseek",
    skipPrefixes: ["deepseek/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "gemini",
    keywords: ["gemini"],
    envKey: "GEMINI_API_KEY",
    displayName: "Gemini",
    litellmPrefix: "gemini",
    skipPrefixes: ["gemini/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "zhipu",
    keywords: ["zhipu", "glm", "zai"],
    envKey: "ZAI_API_KEY",
    displayName: "Zhipu AI",
    litellmPrefix: "zai",
    skipPrefixes: ["zhipu/", "zai/", "openrouter/", "hosted_vllm/"],
    envExtras: [["ZHIPUAI_API_KEY", "{api_key}"]],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "dashscope",
    keywords: ["qwen", "dashscope"],
    envKey: "DASHSCOPE_API_KEY",
    displayName: "DashScope",
    litellmPrefix: "dashscope",
    skipPrefixes: ["dashscope/", "openrouter/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "moonshot",
    keywords: ["moonshot", "kimi"],
    envKey: "MOONSHOT_API_KEY",
    displayName: "Moonshot",
    litellmPrefix: "moonshot",
    skipPrefixes: ["moonshot/", "openrouter/"],
    envExtras: [["MOONSHOT_API_BASE", "{api_base}"]],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.moonshot.ai/v1",
    stripModelPrefix: false,
    modelOverrides: [["kimi-k2.5", { temperature: 1.0 }]]
  },
  {
    name: "minimax",
    keywords: ["minimax"],
    envKey: "MINIMAX_API_KEY",
    displayName: "MiniMax",
    litellmPrefix: "minimax",
    skipPrefixes: ["minimax/", "openrouter/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.minimax.io/v1",
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "vllm",
    keywords: ["vllm"],
    envKey: "HOSTED_VLLM_API_KEY",
    displayName: "vLLM/Local",
    litellmPrefix: "hosted_vllm",
    skipPrefixes: [],
    envExtras: [],
    isGateway: false,
    isLocal: true,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "",
    stripModelPrefix: false,
    modelOverrides: []
  }
];

export function findProviderByName(name: string): ProviderSpec | undefined {
  return PROVIDERS.find((spec) => spec.name === name);
}

export function providerLabel(spec: ProviderSpec): string {
  return spec.displayName || spec.name;
}
