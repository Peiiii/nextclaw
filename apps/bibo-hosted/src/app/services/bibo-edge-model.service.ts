import { readOpenAiSsePayloads } from "@nextclaw/core/openai-sse";
import { appendCurrentTimeContextTail, serializeModelInputTail } from "@nextclaw/kernel/model-input";
import type { CompactionSummaryProvider } from "@nextclaw/kernel/context-compaction";
import type { NcpLLMApi, OpenAIChatChunk } from "@nextclaw/ncp";
import { forwardBiboModel } from "./bibo-model-transport.service";
import type { RunTrace } from "../diagnostics/bibo-diagnostics.utils";

export function createBiboEdgeModel(env: Env, userId: string, trace: RunTrace, onFirstModelStart?: () => void): {
  llmApi: NcpLLMApi;
  summaryProvider: CompactionSummaryProvider;
} {
  let modelStarted = false;
  const llmApi: NcpLLMApi = {
    generate: async function* (input, options) {
      if (!modelStarted) { modelStarted = true; onFirstModelStart?.(); }
      const response = await forwardBiboModel({
        messages: [...input.messages, { role: "user", content: serializeModelInputTail(appendCurrentTimeContextTail(input.contextTail)) }],
        tools: input.tools, max_tokens: input.max_tokens, stream: true,
      }, env, userId, trace, Date.now(), options?.signal);
      if (!response.ok) throw new Error(response.headers.get("x-bibo-budget-rejected") === "1" ? "BIBO_MODEL_QUOTA_EXHAUSTED" : response.status === 429 ? "Bibo model request failed: 429" :
        response.status === 413 ? "Bibo model request failed: 413" : `Chat Completions API failed: ${response.status}`);
      for await (const payload of readOpenAiSsePayloads(response)) yield payload as OpenAIChatChunk;
    },
  };
  const summaryProvider: CompactionSummaryProvider = {
    chat: async (input) => {
      const response = await forwardBiboModel({ messages: input.messages, max_tokens: input.maxTokens, stream: false },
        env, userId, trace, Date.now(), input.signal);
      if (!response.ok) throw new Error(response.headers.get("x-bibo-budget-rejected") === "1" ? "BIBO_MODEL_QUOTA_EXHAUSTED" :
        `Context compaction summary failed: ${response.status}`);
      const body = await response.json() as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
        usage?: Record<string, number>;
      };
      return { content: body.choices?.[0]?.message?.content ?? null, finishReason: body.choices?.[0]?.finish_reason ?? "unknown", usage: body.usage ?? {} };
    },
  };
  return { llmApi, summaryProvider };
}
