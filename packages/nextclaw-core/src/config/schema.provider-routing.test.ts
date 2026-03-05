import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureProviderCatalog } from "../providers/registry.js";
import { ConfigSchema, getApiBase, getProviderName } from "./schema.js";

describe("provider apiBase routing", () => {
  beforeEach(() => {
    configureProviderCatalog([
      {
        id: "test-builtin-providers",
        providers: [
          {
            name: "nextclaw",
            keywords: ["nextclaw", "dashscope/", "qwen3.5", "qwen"],
            envKey: "NEXTCLAW_API_KEY",
            defaultApiBase: "https://ai-gateway-api.nextclaw.io/v1",
            isGateway: true,
            isLocal: false
          },
          {
            name: "deepseek",
            keywords: ["deepseek"],
            envKey: "DEEPSEEK_API_KEY",
            defaultApiBase: "https://api.deepseek.com",
            isGateway: false,
            isLocal: false
          }
        ]
      }
    ]);
  });

  afterEach(() => {
    configureProviderCatalog([]);
  });

  it("uses built-in nextclaw provider when prefixed provider has no apiKey", () => {
    const config = ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: "nc_free_test_key"
        }
      }
    });

    expect(getProviderName(config, "dashscope/qwen3.5-flash")).toBe("nextclaw");
    expect(getApiBase(config, "dashscope/qwen3.5-flash")).toBe("https://ai-gateway-api.nextclaw.io/v1");
  });

  it("uses provider default api base for non-gateway providers when apiBase is unset", () => {
    const config = ConfigSchema.parse({
      providers: {
        deepseek: {
          apiKey: "sk-deepseek"
        }
      }
    });

    expect(getApiBase(config, "deepseek-chat")).toBe("https://api.deepseek.com");
  });

  it("prefers explicit provider apiBase over provider default", () => {
    const config = ConfigSchema.parse({
      providers: {
        deepseek: {
          apiKey: "sk-deepseek",
          apiBase: "https://custom.deepseek.example/v1"
        }
      }
    });

    expect(getApiBase(config, "deepseek-chat")).toBe("https://custom.deepseek.example/v1");
  });

  it("routes custom provider by model prefix and uses its explicit apiBase", () => {
    const config = ConfigSchema.parse({
      providers: {
        "custom-1": {
          apiKey: "sk-relay",
          apiBase: "https://relay-b.example.com/v1"
        }
      }
    });

    expect(getProviderName(config, "custom-1/gpt-4o-mini")).toBe("custom-1");
    expect(getApiBase(config, "custom-1/gpt-4o-mini")).toBe("https://relay-b.example.com/v1");
  });
});
