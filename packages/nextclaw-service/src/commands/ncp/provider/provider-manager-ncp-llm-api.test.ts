import { describe, expect, it } from "vitest";
import type { LLMStreamEvent, ProviderManager } from "@nextclaw/core";
import { ProviderManagerNcpLLMApi } from "./provider-manager-ncp-llm-api.js";

describe("ProviderManagerNcpLLMApi", () => {
  it("does not duplicate reasoning or tool call deltas in the final chunk", async () => {
    const api = new ProviderManagerNcpLLMApi({
      get() {
        return {
          getDefaultModel: () => "default-model",
        };
      },
      async *chatStream(): AsyncGenerator<LLMStreamEvent> {
        yield {
          type: "reasoning_delta",
          delta: "need a tool first",
        };
        yield {
          type: "tool_call_delta",
          toolCalls: [
            {
              index: 0,
              id: "call-1",
              type: "function",
              function: {
                name: "list_dir",
                arguments: "{\"path\":\".\"}",
              },
            },
          ],
        };
        yield {
          type: "done",
          response: {
            content: "",
            reasoningContent: "need a tool first",
            toolCalls: [
              {
                id: "call-1",
                name: "list_dir",
                arguments: { path: "." },
              },
            ],
            finishReason: "tool_calls",
            usage: {},
          },
        };
      },
    } as unknown as ProviderManager);

    const chunks = [];
    for await (const chunk of api.generate({
      messages: [{ role: "user", content: "hello" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.choices?.[0]?.delta?.reasoning_content).toBe("need a tool first");
    expect(chunks[1]?.choices?.[0]?.delta?.tool_calls).toEqual([
      {
        index: 0,
        id: "call-1",
        type: "function",
        function: {
          name: "list_dir",
          arguments: "{\"path\":\".\"}",
        },
      },
    ]);
    expect(chunks[2]?.choices?.[0]?.delta).toEqual({});
    expect(chunks[2]?.choices?.[0]?.finish_reason).toBe("tool_calls");
  });
});
