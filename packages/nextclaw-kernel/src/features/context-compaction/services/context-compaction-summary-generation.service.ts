import { estimateInputTokens } from "@nextclaw/core/model-input-budget";
import type { ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction";
import {
  fitContextCompactionSummaryInput,
  normalizeContextCompactionSummary,
} from "@kernel/utils/context-compaction-summary-input.utils.js";

export type GeneratedCompactionSummary = {
  diagnostics: NonNullable<ContextCompactionCheckpoint["summaryDiagnostics"]>;
  summary: string;
};

export type CompactionSummaryProvider = {
  chat(input: {
    model: string;
    maxTokens: number;
    messages: Record<string, unknown>[];
    requestId: string;
    sessionId: string;
    signal?: AbortSignal;
    thinkingLevel: "off";
  }): Promise<{ content: string | null; finishReason: string; usage: Record<string, number>; toolCalls?: readonly unknown[] }>;
};

type SummaryGenerationRequest = {
  maxInputTokens: number;
  maxInstallableSummaryTokens: number;
  maxTokens: number;
  messages: Record<string, unknown>[];
  model: string;
  requestId: string;
  sessionId: string;
  signal?: AbortSignal;
  targetSummaryTokens: number;
};

const NATURAL_FINISH_REASONS = new Set(["completed", "end_turn", "stop"]);
const SUMMARY_TIMEOUT_MS = 60_000;
class UnusableCompactionSummary extends Error {}
// Code owns this notice. It never claims that omitted history was summarized.
export const COMPACTION_RECOVERY_NOTICE = [
  "Earlier conversation is archived, not reliably summarized. Its constraints and action outcomes remain unresolved.",
  "Read the original session history before relying on old facts. Do not repeat actions or infer completion.",
  "Only read-only recovery is permitted. If required business conditions cannot be verified, ask a specific clarification.",
].join("\n");

export class ContextCompactionSummaryGenerationService {
  constructor(private readonly providerManager?: CompactionSummaryProvider) {}

  generate = async (params: SummaryGenerationRequest): Promise<GeneratedCompactionSummary> => {
    params.signal?.throwIfAborted();
    let inputTokens = 0;
    let attemptCount = 0;
    let finishReason = "not-called";
    let rawSummaryTokens = 0;
    let providerUsage: Record<string, number> = {};
    let summary = "";
    let failure: string | undefined;
    let sourceTruncated = false;
    const controller = new AbortController();
    const abort = () => controller.abort(params.signal?.reason);
    params.signal?.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!this.providerManager) throw new Error("Summary provider unavailable");
      let messages: Record<string, unknown>[];
      try { const fitted = fitContextCompactionSummaryInput({
        maxInputTokens: params.maxInputTokens, messages: params.messages,
        sourceMaxChars: Math.min(512 * 1024, params.maxInputTokens * 3),
        targetSummaryTokens: params.targetSummaryTokens,
      }); messages = fitted.messages; sourceTruncated = fitted.sourceTruncated;
      } catch (error) { throw new UnusableCompactionSummary(error instanceof Error ? error.message : String(error)); }
      inputTokens = estimateInputTokens(messages);
      attemptCount = 1;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new UnusableCompactionSummary("Compaction summary deadline exceeded");
          controller.abort(error);
          reject(error);
        }, SUMMARY_TIMEOUT_MS);
      });
      const cancelled = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      });
      const response = await Promise.race([
        this.providerManager.chat({
          model: params.model, maxTokens: params.maxTokens, messages,
          requestId: params.requestId, sessionId: params.sessionId,
          signal: controller.signal, thinkingLevel: "off",
        }), timeout, cancelled,
      ]);
      providerUsage = response.usage;
      finishReason = response.finishReason;
      summary = response.content ? normalizeContextCompactionSummary(response.content) : "";
      rawSummaryTokens = summary ? estimateInputTokens(summary) : 0;
      if (response.toolCalls?.length) throw new UnusableCompactionSummary("Unexpected summary tool calls");
      if (!NATURAL_FINISH_REASONS.has(finishReason.trim().toLowerCase())) {
        throw new UnusableCompactionSummary(`Incomplete summary: finishReason=${finishReason}`);
      }
      if (!summary) throw new UnusableCompactionSummary("Empty visible summary");
      if (rawSummaryTokens > Math.min(params.targetSummaryTokens, params.maxInstallableSummaryTokens)) {
        throw new UnusableCompactionSummary("Summary exceeds the installable budget");
      }
    } catch (error) {
      params.signal?.throwIfAborted();
      if (!(error instanceof UnusableCompactionSummary)) throw error;
      failure = error instanceof Error ? error.message : String(error);
      summary = COMPACTION_RECOVERY_NOTICE;
      if (estimateInputTokens(summary) > params.maxInstallableSummaryTokens) {
        throw new Error(`Recovery notice cannot fit the model input budget: ${failure}`);
      }
    } finally {
      if (timer) clearTimeout(timer);
      params.signal?.removeEventListener("abort", abort);
    }
    params.signal?.throwIfAborted();
    return { summary, diagnostics: {
      attemptCount, degraded: failure !== undefined || sourceTruncated, finishReason, sourceTruncated,
      installedSummaryTokens: estimateInputTokens(summary), providerInputTokens: inputTokens,
      providerMaxOutputTokens: params.maxTokens, providerUsage, rawSummaryTokens,
      recovery: failure ? "deterministic-recent-context" : "provider-summary",
      targetSummaryTokens: params.targetSummaryTokens, sourceBatchCount: 1,
      ...(failure ? { failure } : {}),
    } };
  };
}
