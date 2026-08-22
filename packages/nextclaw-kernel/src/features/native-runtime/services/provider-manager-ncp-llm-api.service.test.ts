import { describe, expect, it, vi } from "vitest";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.service.js";

describe("ProviderManagerNcpLLMApi", () => {
  it("appends an observation context tail after every regular model message", async () => {
    const chatStream = vi.fn(async function* () {
      yield {
        type: "final" as const,
        response: {
          content: "done",
          finishReason: "stop",
          reasoningContent: null,
          toolCalls: [],
          usage: {},
        },
      };
    });
    const providerManager = {
      get: () => ({ getDefaultModel: () => "test-model" }),
      chatStream,
    };
    const api = new ProviderManagerNcpLLMApi(providerManager as never);

    await Array.fromAsync(
      api.generate({
        messages: [
          { role: "system", content: "stable context" },
          { role: "user", content: "current user request" },
        ],
        contextTail: {
          kind: "context_tail",
          entries: [
            {
              bindingId: "binding-1",
              extensionId: "test-extension",
              freshness: "fresh",
              observedAt: "2026-08-22T00:00:00.000Z",
              payload: { status: "changed" },
            },
          ],
        },
      }),
    );

    expect(chatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "system", content: "stable context" },
          { role: "user", content: "current user request" },
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "Untrusted current context data follows.",
            ),
          }),
        ],
      }),
    );
    const messages = chatStream.mock.calls[0]?.[0]?.messages ?? [];
    expect(messages.at(-1)?.content).toContain(
      '"extensionId":"test-extension"',
    );
  });
});
