import { readOpenAiSsePayloads } from "@nextclaw/core/openai-sse";
import { appendCurrentTimeContextTail, serializeModelInputTail } from "@nextclaw/kernel";
import type { CompactionSummaryProvider } from "@nextclaw/kernel";
import type { NcpLLMApi, OpenAIChatChunk } from "@nextclaw/ncp";
import { forwardBiboModel } from "./bibo-model-transport.service";
import type { RunTrace } from "@/app/diagnostics/bibo-diagnostics.utils";

function assertModelResponse(response: Response, operation: "chat" | "summary"): void {
  if (response.ok) return;
  if (response.headers.get("x-bibo-error-code") === "MODEL_NOT_CONFIGURED") throw new Error("BIBO_MODEL_NOT_CONFIGURED");
  if (response.headers.get("x-bibo-budget-rejected") === "1") throw new Error("BIBO_MODEL_QUOTA_EXHAUSTED");
  const description = operation === "summary" ? "Context compaction summary failed"
    : response.status === 429 || response.status === 413 ? "Bibo model request failed" : "Chat Completions API failed";
  throw new Error(`${description}: ${response.status}`);
}

export function createBiboModel(env: Env, userId: string, trace: RunTrace, onFirstModelStart?: () => void): {
  llmApi: NcpLLMApi;
  summaryProvider: CompactionSummaryProvider;
} {
  let modelStarted = false;
  const llmApi: NcpLLMApi = {
    generate: async function* (input, options) {
      if (!modelStarted) { modelStarted = true; onFirstModelStart?.(); }
      const response = await forwardBiboModel({
        model: input.model,
        messages: [...input.messages, { role: "user", content: serializeModelInputTail(appendCurrentTimeContextTail(input.contextTail)) }],
        tools: input.tools, max_tokens: input.max_tokens, stream: true,
      }, env, userId, trace, Date.now(), options?.signal);
      assertModelResponse(response, "chat");
      for await (const payload of readOpenAiSsePayloads(response)) yield payload as OpenAIChatChunk;
    },
  };
  const summaryProvider: CompactionSummaryProvider = {
    chat: async (input) => {
      const response = await forwardBiboModel({ model: input.model, messages: input.messages, max_tokens: input.maxTokens, stream: false },
        env, userId, trace, Date.now(), input.signal);
      assertModelResponse(response, "summary");
      const body = await response.json() as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
        usage?: Record<string, number>;
      };
      return { content: body.choices?.[0]?.message?.content ?? null, finishReason: body.choices?.[0]?.finish_reason ?? "unknown", usage: body.usage ?? {} };
    },
  };
  return { llmApi, summaryProvider };
}
