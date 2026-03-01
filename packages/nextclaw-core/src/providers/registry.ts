export type WireApiMode = "auto" | "chat" | "responses";

export type ProviderSpec = {
  name: string;
  keywords: string[];
  envKey: string;
  displayName?: string;
  modelPrefix?: string;
  defaultModels?: string[];
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
  supportsWireApi?: boolean;
  wireApiOptions?: WireApiMode[];
  defaultWireApi?: WireApiMode;
};

export const PROVIDERS: ProviderSpec[] = [
  {
    name: "openrouter",
    keywords: ["openrouter"],
    envKey: "OPENROUTER_API_KEY",
    displayName: "OpenRouter",
    modelPrefix: "openrouter",
    litellmPrefix: "openrouter",
    skipPrefixes: [],
    envExtras: [],
    isGateway: true,
    isLocal: false,
    detectByKeyPrefix: "sk-or-",
    detectByBaseKeyword: "openrouter",
    defaultApiBase: "https://openrouter.ai/api/v1",
    defaultModels: [
      "openrouter/minimax/minimax-m2.5",
      "openrouter/google/gemini-3-flash-preview",
      "openrouter/deepseek/deepseek-v3.2",
      "openrouter/x-ai/grok-4.1-fast",
      "openrouter/z-ai/glm-5",
      "openrouter/anthropic/claude-opus-4.6",
      "openrouter/openai/gpt-5.3-codex"
    ],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "aihubmix",
    keywords: ["aihubmix"],
    envKey: "OPENAI_API_KEY",
    displayName: "AiHubMix",
    modelPrefix: "aihubmix",
    litellmPrefix: "openai",
    skipPrefixes: [],
    envExtras: [],
    isGateway: true,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "aihubmix",
    defaultApiBase: "https://aihubmix.com/v1",
    defaultModels: ["aihubmix/gpt-5.3-codex", "aihubmix/claude-opus-4.6", "aihubmix/gemini-3.1-pro-preview"],
    stripModelPrefix: true,
    modelOverrides: []
  },
  {
    name: "anthropic",
    keywords: ["anthropic", "claude"],
    envKey: "ANTHROPIC_API_KEY",
    displayName: "Anthropic",
    modelPrefix: "anthropic",
    litellmPrefix: "anthropic",
    skipPrefixes: ["anthropic/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.anthropic.com",
    defaultModels: [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6"
    ],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "openai",
    keywords: ["openai", "gpt"],
    envKey: "OPENAI_API_KEY",
    displayName: "OpenAI",
    modelPrefix: "openai",
    litellmPrefix: "openai",
    skipPrefixes: ["openai/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.openai.com/v1",
    defaultModels: ["openai/gpt-5.3-codex", "openai/gpt-5-mini", "openai/gpt-5-nano"],
    stripModelPrefix: false,
    modelOverrides: [],
    supportsWireApi: true,
    wireApiOptions: ["auto", "chat", "responses"],
    defaultWireApi: "auto"
  },
  {
    name: "deepseek",
    keywords: ["deepseek"],
    envKey: "DEEPSEEK_API_KEY",
    displayName: "DeepSeek",
    modelPrefix: "deepseek",
    litellmPrefix: "deepseek",
    skipPrefixes: ["deepseek/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.deepseek.com",
    defaultModels: ["deepseek/deepseek-chat", "deepseek/deepseek-reasoner"],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "gemini",
    keywords: ["gemini"],
    envKey: "GEMINI_API_KEY",
    displayName: "Gemini",
    modelPrefix: "gemini",
    litellmPrefix: "gemini",
    skipPrefixes: ["gemini/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModels: [
      "gemini/gemini-3.1-pro-preview",
      "gemini/gemini-3-flash-preview"
    ],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "zhipu",
    keywords: ["zhipu", "glm", "zai"],
    envKey: "ZAI_API_KEY",
    displayName: "Zhipu AI",
    modelPrefix: "zai",
    litellmPrefix: "zai",
    skipPrefixes: ["zhipu/", "zai/", "openrouter/", "hosted_vllm/"],
    envExtras: [["ZHIPUAI_API_KEY", "{api_key}"]],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://open.bigmodel.cn/api/paas/v4",
    defaultModels: ["zai/glm-5"],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "dashscope",
    keywords: ["qwen", "dashscope"],
    envKey: "DASHSCOPE_API_KEY",
    displayName: "DashScope",
    modelPrefix: "dashscope",
    litellmPrefix: "dashscope",
    skipPrefixes: ["dashscope/", "openrouter/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: [
      "dashscope/qwen3.5-plus",
      "dashscope/qwen3.5-flash",
      "dashscope/qwen3.5-397b-a17b",
      "dashscope/qwen3.5-122b-a10b",
      "dashscope/qwen3.5-35b-a3b",
      "dashscope/qwen3.5-27b"
    ],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "moonshot",
    keywords: ["moonshot", "kimi"],
    envKey: "MOONSHOT_API_KEY",
    displayName: "Moonshot",
    modelPrefix: "moonshot",
    litellmPrefix: "moonshot",
    skipPrefixes: ["moonshot/", "openrouter/"],
    envExtras: [["MOONSHOT_API_BASE", "{api_base}"]],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.moonshot.ai/v1",
    defaultModels: ["moonshot/kimi-k2.5"],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "minimax",
    keywords: ["minimax"],
    envKey: "MINIMAX_API_KEY",
    displayName: "MiniMax",
    modelPrefix: "minimax",
    litellmPrefix: "minimax",
    skipPrefixes: ["minimax/", "openrouter/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.minimax.io/v1",
    defaultModels: ["minimax/MiniMax-M2.5"],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "vllm",
    keywords: ["vllm"],
    envKey: "HOSTED_VLLM_API_KEY",
    displayName: "vLLM/Local",
    modelPrefix: "hosted_vllm",
    litellmPrefix: "hosted_vllm",
    skipPrefixes: [],
    envExtras: [],
    isGateway: false,
    isLocal: true,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "http://127.0.0.1:8000/v1",
    defaultModels: [
      "hosted_vllm/meta-llama/Llama-3.1-8B-Instruct",
      "hosted_vllm/Qwen/Qwen2.5-7B-Instruct"
    ],
    stripModelPrefix: false,
    modelOverrides: []
  },
  {
    name: "groq",
    keywords: ["groq"],
    envKey: "GROQ_API_KEY",
    displayName: "Groq",
    modelPrefix: "groq",
    litellmPrefix: "groq",
    skipPrefixes: ["groq/"],
    envExtras: [],
    isGateway: false,
    isLocal: false,
    detectByKeyPrefix: "",
    detectByBaseKeyword: "",
    defaultApiBase: "https://api.groq.com/openai/v1",
    defaultModels: ["groq/openai/gpt-oss-120b", "groq/llama-3.1-8b-instant"],
    stripModelPrefix: false,
    modelOverrides: []
  }
];

export function findProviderByName(name: string): ProviderSpec | undefined {
  return PROVIDERS.find((spec) => spec.name === name);
}

export function findProviderByModel(model: string): ProviderSpec | undefined {
  const modelLower = model.toLowerCase();
  return PROVIDERS.find((spec) => {
    if (spec.isGateway || spec.isLocal) {
      return false;
    }
    return spec.keywords.some((keyword) => modelLower.includes(keyword));
  });
}

export function findGateway(
  providerName?: string | null,
  apiKey?: string | null,
  apiBase?: string | null
): ProviderSpec | undefined {
  if (providerName) {
    const spec = findProviderByName(providerName);
    if (spec && (spec.isGateway || spec.isLocal)) {
      return spec;
    }
  }
  for (const spec of PROVIDERS) {
    if (spec.detectByKeyPrefix && apiKey && apiKey.startsWith(spec.detectByKeyPrefix)) {
      return spec;
    }
    if (spec.detectByBaseKeyword && apiBase && apiBase.includes(spec.detectByBaseKeyword)) {
      return spec;
    }
  }
  return undefined;
}

export function providerLabel(spec: ProviderSpec): string {
  return spec.displayName || spec.name;
}
