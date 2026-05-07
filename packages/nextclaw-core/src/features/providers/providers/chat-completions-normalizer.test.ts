import { describe, expect, it } from "vitest";
import {
  ChatCompletionsPayloadError,
  normalizeChatCompletionsResponse
} from "./chat-completions-normalizer.js";

describe("normalizeChatCompletionsResponse", () => {
  it("parses standard chat completions payload", () => {
    const response = {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            content: "hello",
            reasoning_content: "think",
            tool_calls: [
              {
                type: "function",
                id: "call-1",
                function: {
                  name: "search",
                  arguments: "{\"q\":\"nextclaw\"}"
                }
              }
            ]
          }
        }
      ],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 22,
        total_tokens: 33
      }
    };

    const parsed = normalizeChatCompletionsResponse(response, (raw) => {
      if (typeof raw === "string") {
        return JSON.parse(raw) as Record<string, unknown>;
      }
      return {};
    });

    expect(parsed).toEqual({
      content: "hello",
      toolCalls: [
        {
          id: "call-1",
          name: "search",
          arguments: {
            q: "nextclaw"
          }
        }
      ],
      finishReason: "tool_calls",
      usage: {
        prompt_tokens: 11,
        completion_tokens: 22,
        total_tokens: 33
      },
      reasoningContent: "think"
    });
  });

  it("throws invalid payload error when choices are missing", () => {
    try {
      normalizeChatCompletionsResponse({ foo: "bar" }, () => ({}));
      throw new Error("expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatCompletionsPayloadError);
      expect((error as ChatCompletionsPayloadError).code).toBe("INVALID_CHAT_COMPLETIONS_PAYLOAD");
      expect((error as Error).message).toContain("missing choices[0]");
    }
  });

  it("throws upstream payload error when error field exists", () => {
    try {
      normalizeChatCompletionsResponse(
        {
          error: {
            message: "model is blocked"
          }
        },
        () => ({})
      );
      throw new Error("expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(ChatCompletionsPayloadError);
      expect((error as ChatCompletionsPayloadError).code).toBe("UPSTREAM_CHAT_COMPLETIONS_ERROR");
      expect((error as Error).message).toContain("model is blocked");
    }
  });

  it("normalizes array-based message content", () => {
    const response = {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: [
              { type: "output_text", text: "Scheduled successfully. " },
              { type: "text", text: { value: "I will notify you daily." } }
            ]
          }
        }
      ]
    };

    const parsed = normalizeChatCompletionsResponse(response, () => ({}));
    expect(parsed.content).toBe("Scheduled successfully. I will notify you daily.");
    expect(parsed.toolCalls).toEqual([]);
  });

  it("normalizes object message content", () => {
    const response = {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: {
              type: "output_text",
              text: {
                value: "done"
              }
            }
          }
        }
      ]
    };

    const parsed = normalizeChatCompletionsResponse(response, () => ({}));
    expect(parsed.content).toBe("done");
    expect(parsed.toolCalls).toEqual([]);
  });

  it("flattens nested usage details for cache observation", () => {
    const response = {
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "done"
          }
        }
      ],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 50,
        total_tokens: 1250,
        prompt_tokens_details: {
          cached_tokens: 1024
        }
      }
    };

    const parsed = normalizeChatCompletionsResponse(response, () => ({}));
    expect(parsed.usage).toMatchObject({
      prompt_tokens: 1200,
      completion_tokens: 50,
      total_tokens: 1250,
      prompt_tokens_details_cached_tokens: 1024
    });
  });
});
