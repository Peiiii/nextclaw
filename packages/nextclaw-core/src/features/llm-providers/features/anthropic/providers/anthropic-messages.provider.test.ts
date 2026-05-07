import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicMessagesProvider } from "./anthropic-messages.provider.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AnthropicMessagesProvider", () => {
  it("posts Anthropic Messages payload to /v1/messages when apiBase does not include /v1", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 10,
            output_tokens: 4
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const provider = new AnthropicMessagesProvider({
      apiKey: "kimi-secret",
      apiBase: "https://api.kimi.com/coding",
      defaultModel: "kimi-for-coding",
      extraHeaders: {
        "User-Agent": "claude-code/0.1.0"
      }
    });

    const response = await provider.chat({
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 32
    });

    expect(capturedUrl).toBe("https://api.kimi.com/coding/v1/messages");
    expect(capturedHeaders.authorization).toBe("Bearer kimi-secret");
    expect(capturedHeaders["anthropic-version"]).toBe("2023-06-01");
    expect(capturedHeaders["user-agent"]).toBe("claude-code/0.1.0");
    expect(capturedBody).toMatchObject({
      model: "kimi-for-coding",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "ping" }]
        }
      ]
    });
    expect(response).toMatchObject({
      content: "ok",
      toolCalls: [],
      finishReason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14
      }
    });
  });

  it("uses /messages when apiBase already ends with /v1 and maps tool_use blocks", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      capturedUrl = String(input);
      return new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "Need a tool." },
            { type: "tool_use", id: "tool-1", name: "read_file", input: { path: "README.md" } }
          ],
          stop_reason: "tool_use",
          usage: {
            input_tokens: 6,
            output_tokens: 3
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const provider = new AnthropicMessagesProvider({
      apiKey: "kimi-secret",
      apiBase: "https://api.kimi.com/coding/v1",
      defaultModel: "kimi-for-coding"
    });

    const response = await provider.chat({
      messages: [
        { role: "user", content: "inspect the repo" }
      ]
    });

    expect(capturedUrl).toBe("https://api.kimi.com/coding/v1/messages");
    expect(response).toEqual({
      content: "Need a tool.",
      toolCalls: [
        {
          id: "tool-1",
          name: "read_file",
          arguments: { path: "README.md" }
        }
      ],
      finishReason: "tool_use",
      usage: {
        input_tokens: 6,
        output_tokens: 3,
        prompt_tokens: 6,
        completion_tokens: 3,
        total_tokens: 9
      },
      reasoningContent: null
    });
  });
});
