import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiteLLMProvider } from "./litellm_provider.js";
import type { LLMResponse } from "./base.js";
import { configureProviderCatalog } from "./registry.js";

beforeEach(() => {
  configureProviderCatalog([
    {
      id: "test-providers",
      providers: [
        {
          name: "kimi-coding",
          keywords: ["kimi-coding", "kimi-for-coding"],
          envKey: "KIMI_CODING_API_KEY",
          apiProtocol: "anthropic-messages",
          defaultHeaders: {
            "User-Agent": "claude-code/0.1.0"
          },
          defaultApiBase: "https://api.kimi.com/coding",
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

function mockResponse(): LLMResponse {
  return {
    content: "ok",
    toolCalls: [],
    finishReason: "stop",
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2
    }
  };
}

describe("LiteLLMProvider custom provider routing prefix", () => {
  it("removes only the first custom provider prefix before upstream call", async () => {
    const provider = new LiteLLMProvider({
      apiKey: "sk-test",
      apiBase: "http://127.0.0.1:9/v1",
      defaultModel: "custom-1/minimax/MiniMax-M2.5",
      providerName: "custom-1"
    });

    const chat = vi.fn().mockResolvedValue(mockResponse());
    (provider as unknown as { client: { chat: typeof chat } }).client = {
      chat
    };

    await provider.chat({
      model: "custom-1/minimax/MiniMax-M2.5",
      messages: [{ role: "user", content: "ping" }]
    });

    const firstCall = chat.mock.calls[0]?.[0] as { model?: string };
    expect(firstCall.model).toBe("minimax/MiniMax-M2.5");
  });

  it("routes kimi-coding through AnthropicMessagesProvider and merges default headers", () => {
    const provider = new LiteLLMProvider({
      apiKey: "sk-test",
      apiBase: "https://api.kimi.com/coding",
      defaultModel: "kimi-coding/kimi-for-coding",
      providerName: "kimi-coding",
      extraHeaders: {
        "X-Kimi-Tenant": "tenant-a"
      }
    }) as unknown as {
      client: {
        constructor: { name: string };
        extraHeaders?: Record<string, string> | null;
      };
    };

    expect(provider.client.constructor.name).toBe("AnthropicMessagesProvider");
    expect(provider.client.extraHeaders).toEqual({
      "User-Agent": "claude-code/0.1.0",
      "X-Kimi-Tenant": "tenant-a"
    });
  });

  it("passes custom provider wireApi to OpenAI-compatible client", () => {
    const provider = new LiteLLMProvider({
      apiKey: "sk-test",
      apiBase: "https://relay.example.com/v1",
      defaultModel: "custom-1/gpt-4o-mini",
      providerName: "custom-1",
      wireApi: "responses"
    }) as unknown as {
      client: {
        wireApi?: string;
      };
    };

    expect(provider.client.wireApi).toBe("responses");
  });
});
