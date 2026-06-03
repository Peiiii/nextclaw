import { describe, expect, it } from "vitest";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { ConfigSchema, type LLMResponse, type LLMStreamEvent } from "@nextclaw/core";

type LlmProviderManagerInternals = {
  getOrCreateProvider: (route: unknown) => {
    client?: {
      chat?: (params: Record<string, unknown>) => Promise<LLMResponse>;
      chatStream?: (params: Record<string, unknown>) => AsyncGenerator<LLMStreamEvent>;
    };
  };
  resolveRoute: (model?: string | null) => unknown;
  prepareMessagesForProvider: (
    route: unknown,
    messages: Array<Record<string, unknown>>,
  ) => Array<Record<string, unknown>>;
};

function prepareMessages(
  manager: LlmProviderManager,
  model: string,
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const internals = manager as unknown as LlmProviderManagerInternals;
  return internals.prepareMessagesForProvider(internals.resolveRoute(model), messages);
}

function mockResolvedProviderClient(
  manager: LlmProviderManager,
  model: string,
  client: NonNullable<ReturnType<LlmProviderManagerInternals["getOrCreateProvider"]>["client"]>,
): void {
  const internals = manager as unknown as LlmProviderManagerInternals;
  const route = internals.resolveRoute(model);
  const provider = internals.getOrCreateProvider(route);
  provider.client = client;
}

function response(): LLMResponse {
  return {
    content: "ok",
    toolCalls: [],
    finishReason: "stop",
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  };
}

describe("LlmProviderManager", () => {
  it("keeps image inputs for builtin vision model specs when persisted modelConfig is empty", () => {
    const manager = new LlmProviderManager();
    manager.load(ConfigSchema.parse({
      agents: {
        defaults: {
          model: "aihubmix/gemini-3.1-pro-preview",
        },
      },
      providers: {
        aihubmix: {
          apiKey: "sk-test",
          modelConfig: {},
        },
      },
    }));

    const messages = prepareMessages(
      manager,
      "aihubmix/gemini-3.1-pro-preview",
      [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
            { type: "text", text: "describe it" },
          ],
        },
      ],
    );

    expect(messages).toEqual([
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
          { type: "text", text: "describe it" },
        ],
      },
    ]);
  });

  it("omits image inputs when the selected model is not configured for vision", () => {
    const manager = new LlmProviderManager();
    manager.load(ConfigSchema.parse({
      agents: {
        defaults: {
          model: "deepseek/deepseek-chat",
        },
      },
      providers: {
        deepseek: {
          apiKey: "sk-test",
          modelConfig: {},
        },
      },
    }));

    const messages = prepareMessages(
      manager,
      "deepseek/deepseek-chat",
      [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
            { type: "text", text: "describe it" },
          ],
        },
      ],
    );

    expect(messages).toEqual([
      {
        role: "user",
        content: "[Image omitted: the selected model is not configured for vision input.]\n\ndescribe it",
      },
    ]);
  });

  it("sends provider-type model to upstream after resolving a provider instance route", async () => {
    const manager = new LlmProviderManager();
    manager.load(ConfigSchema.parse({
      agents: {
        defaults: {
          model: "deepseek-2/deepseek-v4-flash",
        },
      },
      providers: {
        "deepseek-2": {
          providerType: "deepseek",
          apiKey: "sk-test",
          apiBase: "https://api.deepseek.com/v1",
          models: ["deepseek-2/deepseek-v4-flash"],
        },
      },
    }));

    let upstreamModel: unknown;
    mockResolvedProviderClient(manager, "deepseek-2/deepseek-v4-flash", {
      chat: async (params) => {
        upstreamModel = params.model;
        return response();
      },
    });

    await manager.chat({
      model: "deepseek-2/deepseek-v4-flash",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(upstreamModel).toBe("deepseek-v4-flash");
  });

  it("keeps legacy builtin provider routes compatible", async () => {
    const manager = new LlmProviderManager();
    manager.load(ConfigSchema.parse({
      agents: {
        defaults: {
          model: "deepseek/deepseek-v4-flash",
        },
      },
      providers: {
        deepseek: {
          apiKey: "sk-test",
          apiBase: "https://api.deepseek.com/v1",
          models: ["deepseek/deepseek-v4-flash"],
        },
      },
    }));

    let upstreamModel: unknown;
    mockResolvedProviderClient(manager, "deepseek/deepseek-v4-flash", {
      chat: async (params) => {
        upstreamModel = params.model;
        return response();
      },
    });

    await manager.chat({
      model: "deepseek/deepseek-v4-flash",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(upstreamModel).toBe("deepseek-v4-flash");
  });
});
