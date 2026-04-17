import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAiCompatibleUpstream } from "../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/codex-openai-responses-bridge-request.utils.js";

describe("codex openai responses bridge request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges instructions and developer input into a single system message", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 1,
          model: "MiniMax-M2.7",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "OK",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await callOpenAiCompatibleUpstream({
      config: {
        upstreamApiBase: "https://api.minimaxi.com/v1",
        upstreamApiKey: "test-key",
        defaultModel: "MiniMax-M2.7",
        modelPrefixes: ["minimax"],
      },
      body: {
        model: "minimax/MiniMax-M2.7",
        instructions: "Base system prompt",
        input: [
          {
            type: "message",
            role: "developer",
            content: [
              {
                type: "input_text",
                text: "Developer constraints",
              },
            ],
          },
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Reply exactly OK",
              },
            ],
          },
        ],
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestInit = fetchSpy.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body)) as {
      messages: Array<{ role: string; content: unknown }>;
    };

    expect(requestBody.messages).toEqual([
      {
        role: "system",
        content: "Base system prompt\n\nDeveloper constraints",
      },
      {
        role: "user",
        content: "Reply exactly OK",
      },
    ]);
  });
});
