import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpLLMApiInput, OpenAIChatMessage } from "@nextclaw/ncp";
import { RequestContextTailManager } from "@kernel/managers/request-context-tail.manager.js";
import { appendCurrentTimeContextTail } from "@kernel/utils/agent-model-input-tail.utils.js";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.service.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("ProviderManagerNcpLLMApi", () => {
  it.each([false, true])("refreshes time on every send while preserving history and prefix (tools=%s)", async (withTools) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("TZ", "Asia/Shanghai");
    const sent: Array<Array<Record<string, unknown>>> = [];
    const api = new ProviderManagerNcpLLMApi({
      get: () => ({ getDefaultModel: () => "test-model" }),
      chatStream: async function* (request: { messages: Array<Record<string, unknown>> }) {
        sent.push(request.messages);
        yield { type: "delta", delta: "reply" };
      },
    } as never);
    const messages: OpenAIChatMessage[] = [
      { role: "system", content: "stable instructions" },
      { role: "user", content: "What time is it?" },
      ...(withTools ? [
        { role: "assistant" as const, content: null, tool_calls: [{
          id: "call-1", type: "function" as const, function: { name: "lookup", arguments: "{}" },
        }] },
        { role: "tool" as const, tool_call_id: "call-1", content: "tool output" },
      ] : []),
    ];
    const input: NcpLLMApiInput = {
      messages,
      ...(withTools ? {
        contextTail: { kind: "model_input_tail" as const, sections: [{ source: "observation", trust: "untrusted" as const, content: "unchanged" }] },
      } : {}),
    };
    const original = JSON.stringify(input);
    messages.forEach(Object.freeze);
    Object.freeze(messages);
    Object.freeze(input.contextTail?.sections);
    Object.freeze(input.contextTail);
    Object.freeze(input);
    for (const now of ["2026-09-14T01:00:00.000Z", "2026-09-14T01:02:00.000Z"]) {
      vi.setSystemTime(new Date(now));
      await Array.fromAsync(api.generate(input));
      const wire = sent.at(-1)!;
      expect(wire.slice(0, -1)).toEqual(messages);
      const sections = JSON.parse(String(wire.at(-1)?.content).split("\n").at(-1)!);
      expect(sections).toEqual([
        ...(input.contextTail?.sections ?? []),
        { source: "current-time", trust: "trusted", content: { currentTime: now, timeZone: "Asia/Shanghai", utcOffset: "+08:00" } },
      ]);
      expect(wire).toHaveLength(messages.length + 1);
      expect(JSON.stringify(input)).toBe(original);
    }
    expect(sent[0].slice(0, -1)).toEqual(sent[1].slice(0, -1));
    expect(sent[0].at(-1)).not.toEqual(sent[1].at(-1));
    expect(JSON.parse(JSON.stringify(messages))).toEqual(messages);
  });

  it.each([
    ["UTC", "2026-01-14T12:00:00.000Z", "+00:00"],
    ["America/New_York", "2026-01-14T12:00:00.000Z", "-05:00"],
    ["America/New_York", "2026-07-14T12:00:00.000Z", "-04:00"],
    ["Australia/Adelaide", "2026-01-14T12:00:00.000Z", "+10:30"],
    ["Australia/Adelaide", "2026-07-14T12:00:00.000Z", "+09:30"],
  ])("samples host timezone and the date-specific offset: %s %s", (timeZone, now, utcOffset) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("TZ", timeZone);
    vi.setSystemTime(new Date(now));
    expect(appendCurrentTimeContextTail()).toEqual({
      kind: "model_input_tail",
      sections: [{ source: "current-time", trust: "trusted", content: { currentTime: now, timeZone, utcOffset } }],
    });
  });

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
      api.generate(
        {
          messages: history,
          contextTail: await requestContextTailManager.build({
            sessionId: "session-1",
            runId: "run-1",
            agentId: "main",
            model: "test-model",
          }),
        },
        { sessionId: "session-1", requestId: "message-1" },
      ),
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
        requestId: "message-1",
        sessionId: "session-1",
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
