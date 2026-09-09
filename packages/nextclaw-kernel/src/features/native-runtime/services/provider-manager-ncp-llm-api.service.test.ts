import { describe, expect, it, vi } from "vitest";
import { RequestContextTailManager } from "@kernel/managers/request-context-tail.manager.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.service.js";

describe("ProviderManagerNcpLLMApi", () => {
  it("appends request-scoped context after every regular model message without mutating history", async () => {
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
    const requestContextTailManager = new RequestContextTailManager();
    requestContextTailManager.register({
      provide: () => [
        {
          source: "observation",
          trust: "untrusted",
          content: [
            {
              bindingId: "binding-1",
              extensionId: "test-extension",
              freshness: "fresh",
              observedAt: "2026-08-22T00:00:00.000Z",
              payload: { status: "changed" },
            },
          ],
        },
      ],
    });

    const history = [
      { role: "system" as const, content: "stable context" },
      { role: "user" as const, content: "current user request" },
    ];

    await Array.fromAsync(
      api.generate({
        messages: history,
        contextTail: await requestContextTailManager.build({
          sessionId: "session-1",
          runId: "run-1",
          agentId: "main",
          model: "test-model",
        }),
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
              "Current request-scoped context follows.",
            ),
          }),
        ],
      }),
    );
    const messages = chatStream.mock.calls[0]?.[0]?.messages ?? [];
    expect(messages.at(-1)?.content).toContain('"trust":"untrusted"');
    expect(messages.at(-1)?.content).toContain(
      '"extensionId":"test-extension"',
    );
    expect(history).toEqual([
      { role: "system", content: "stable context" },
      { role: "user", content: "current user request" },
    ]);
  });
});
