import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureProviderCatalog } from "../providers/registry.js";
import { ConfigSchema } from "./schema.js";
import { resolveProviderRuntime } from "./provider-runtime-resolution.js";

describe("resolveProviderRuntime", () => {
  beforeEach(() => {
    configureProviderCatalog([
      {
        id: "test-runtime-resolution-providers",
        providers: [
          {
            name: "nextclaw",
            displayName: "NextClaw Gateway",
            keywords: ["nextclaw", "dashscope/", "qwen3.5", "qwen"],
            envKey: "NEXTCLAW_API_KEY",
            defaultApiBase: "https://ai-gateway-api.nextclaw.io/v1",
            isGateway: true,
            isLocal: false,
          },
          {
            name: "deepseek",
            displayName: "DeepSeek",
            keywords: ["deepseek"],
            envKey: "DEEPSEEK_API_KEY",
            defaultApiBase: "https://api.deepseek.com",
            isGateway: false,
            isLocal: false,
          },
          {
            name: "dashscope",
            displayName: "DashScope",
            keywords: ["qwen", "dashscope"],
            envKey: "DASHSCOPE_API_KEY",
            defaultApiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
            modelPrefix: "dashscope",
            isGateway: false,
            isLocal: false,
          },
          {
            name: "minimax",
            displayName: "MiniMax",
            keywords: ["minimax"],
            envKey: "MINIMAX_API_KEY",
            defaultApiBase: "https://api.minimaxi.com/v1",
            modelPrefix: "minimax",
            isGateway: false,
            isLocal: false,
          },
          {
            name: "zhipu",
            displayName: "Zhipu AI",
            keywords: ["zhipu", "glm", "zai"],
            envKey: "ZAI_API_KEY",
            defaultApiBase: "https://open.bigmodel.cn/api/paas/v4",
            modelPrefix: "zai",
            isGateway: false,
            isLocal: false,
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    configureProviderCatalog([]);
  });

  it("resolves builtin provider runtime fields from model identifier", () => {
    const config = ConfigSchema.parse({
      providers: {
        deepseek: {
          apiKey: "sk-deepseek",
        },
      },
    });

    expect(resolveProviderRuntime(config, "deepseek-chat")).toEqual(
      expect.objectContaining({
        resolvedModel: "deepseek-chat",
        providerLocalModel: "deepseek-chat",
        providerName: "deepseek",
        providerDisplayName: "DeepSeek",
        apiKey: "sk-deepseek",
        apiBase: "https://api.deepseek.com",
      }),
    );
  });

  it("keeps custom provider internal id while exposing display and local model separately", () => {
    const config = ConfigSchema.parse({
      providers: {
        "custom-1": {
          displayName: "yunyi",
          apiKey: "sk-yunyi",
          apiBase: "https://yunyi.example.com/v1",
          models: ["gpt-5.4"],
        },
      },
    });

    expect(resolveProviderRuntime(config, "custom-1/gpt-5.4")).toEqual(
      expect.objectContaining({
        resolvedModel: "custom-1/gpt-5.4",
        providerLocalModel: "gpt-5.4",
        providerName: "custom-1",
        providerDisplayName: "yunyi",
        apiKey: "sk-yunyi",
        apiBase: "https://yunyi.example.com/v1",
      }),
    );
  });

  it("falls through disabled providers and resolves the next enabled route", () => {
    const config = ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: "nc_free_test_key",
        },
        deepseek: {
          enabled: false,
          apiKey: "sk-deepseek",
        },
      },
    });

    expect(resolveProviderRuntime(config, "deepseek-chat")).toEqual(
      expect.objectContaining({
        resolvedModel: "deepseek-chat",
        providerLocalModel: "deepseek-chat",
        providerName: "nextclaw",
        providerDisplayName: "NextClaw Gateway",
        apiKey: "nc_free_test_key",
        apiBase: "https://ai-gateway-api.nextclaw.io/v1",
      }),
    );
  });

  it("resolves prefixed providers through their modelPrefix alias", () => {
    const config = ConfigSchema.parse({
      providers: {
        zhipu: {
          apiKey: "zhipu-key",
        },
      },
    });

    expect(resolveProviderRuntime(config, "zai/glm-5")).toEqual(
      expect.objectContaining({
        resolvedModel: "zai/glm-5",
        providerLocalModel: "glm-5",
        providerName: "zhipu",
        providerDisplayName: "Zhipu AI",
        apiKey: "zhipu-key",
        apiBase: "https://open.bigmodel.cn/api/paas/v4",
      }),
    );
  });

  it("does not silently guess a provider for ambiguous bare model names", () => {
    const config = ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: "nc_free_test_key",
        },
        dashscope: {
          apiKey: "dashscope-key",
        },
        minimax: {
          apiKey: "minimax-key",
        },
      },
    });

    expect(resolveProviderRuntime(config, "qwen3.6-plus")).toEqual(
      expect.objectContaining({
        resolvedModel: "qwen3.6-plus",
        providerLocalModel: "qwen3.6-plus",
        providerName: null,
        providerDisplayName: null,
        apiKey: null,
        apiBase: null,
      }),
    );
  });
});
