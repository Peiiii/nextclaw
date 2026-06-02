import { describe, expect, it } from "vitest";
import { LlmProviderManager } from "@kernel/managers/llm-provider.manager.js";
import { ConfigSchema } from "@nextclaw/core";

type LlmProviderManagerInternals = {
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
});
