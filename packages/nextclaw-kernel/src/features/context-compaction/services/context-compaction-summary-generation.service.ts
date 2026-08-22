import {
  estimateInputTokens,
  type ContextCompactionCheckpoint,
} from "@nextclaw/core";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";
import {
  buildContextCompactionEmergencySummary,
  fitContextCompactionSummaryInput,
  fitContextCompactionSummaryOutput,
  normalizeContextCompactionSummary,
  selectContextCompactionAttemptMessages,
  validateContextCompactionSummary,
} from "@kernel/utils/context-compaction-summary-input.utils.js";

export type GeneratedCompactionSummary = {
  diagnostics: NonNullable<ContextCompactionCheckpoint["summaryDiagnostics"]>;
  summary: string;
};

const TRUNCATED_SUMMARY_FINISH_REASONS = new Set([
  "incomplete",
  "length",
  "max_output_tokens",
  "max_tokens",
]);
const NATURAL_SUMMARY_FINISH_REASONS = new Set([
  "completed",
  "end_turn",
  "stop",
]);
const SUMMARY_ATTEMPT_SOURCE_MAX_CHARS = [120_000, 60_000, 30_000] as const;

type SummaryGenerationRequest = {
  maxInputTokens: number;
  maxInstallableSummaryTokens: number;
  maxTokens: number;
  messages: Record<string, unknown>[];
  model: string;
  signal?: AbortSignal;
  targetSummaryTokens: number;
};

type SummaryAttemptResult = {
  calledProvider: boolean;
  degraded: boolean;
  failure: string;
  finishReason: string;
  inputTokens: number;
  providerUsage: Record<string, number>;
  rawSummaryTokens: number;
  summary: string | null;
};

function mergeProviderUsage(
  total: Record<string, number>,
  usage: Readonly<Record<string, number>>,
): void {
  for (const [key, value] of Object.entries(usage)) {
    if (Number.isFinite(value)) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
}

export class ContextCompactionSummaryGenerationService {
  constructor(private readonly providerManager?: LlmProviderRuntime) {}

  generate = async (params: SummaryGenerationRequest): Promise<GeneratedCompactionSummary> => {
    if (!this.providerManager) {
      throw new Error("context compaction summary generation requires a provider manager");
    }
    let lastFailure = "unknown summary failure";
    let lastFinishReason = "unknown";
    let lastInputTokens = 0;
    let lastRawSummaryTokens = 0;
    let previousInputTokens = Number.POSITIVE_INFINITY;
    let providerCallCount = 0;
    const providerUsage: Record<string, number> = {};

    for (let attempt = 1; attempt <= SUMMARY_ATTEMPT_SOURCE_MAX_CHARS.length; attempt += 1) {
      const result = await this.runAttempt({ attempt, params, previousInputTokens });
      if (!result.calledProvider) {
        lastFailure = result.failure;
        break;
      }
      previousInputTokens = result.inputTokens;
      lastInputTokens = result.inputTokens;
      lastFinishReason = result.finishReason;
      lastRawSummaryTokens = result.rawSummaryTokens;
      providerCallCount += 1;
      mergeProviderUsage(providerUsage, result.providerUsage);
      if (result.summary) {
        return this.buildGeneratedSummary({
          attemptCount: providerCallCount,
          degraded: result.degraded,
          finishReason: result.finishReason,
          inputTokens: result.inputTokens,
          providerUsage,
          rawSummaryTokens: result.rawSummaryTokens,
          recovery: "provider-summary",
          request: params,
          summary: result.summary,
        });
      }
      lastFailure = result.failure;
    }

    const emergencySummary = buildContextCompactionEmergencySummary({
      maxInstallableSummaryTokens: params.maxInstallableSummaryTokens,
      messages: selectContextCompactionAttemptMessages(
        params.messages,
        SUMMARY_ATTEMPT_SOURCE_MAX_CHARS.length,
      ),
    });
    if (!emergencySummary) {
      throw new Error(
        `Context compaction summary failed after ${providerCallCount} provider calls: ${lastFailure}. The previous checkpoint was kept unchanged.`,
      );
    }
    return this.buildGeneratedSummary({
      attemptCount: providerCallCount,
      degraded: true,
      finishReason: lastFinishReason,
      inputTokens: lastInputTokens,
      providerUsage,
      rawSummaryTokens: lastRawSummaryTokens,
      recovery: "deterministic-recent-context",
      request: params,
      summary: emergencySummary,
    });
  };

  private runAttempt = async (input: {
    attempt: number;
    params: SummaryGenerationRequest;
    previousInputTokens: number;
  }): Promise<SummaryAttemptResult> => {
    const { attempt, params, previousInputTokens } = input;
    if (params.signal?.aborted) {
      throw new DOMException("Context compaction summary generation was cancelled", "AbortError");
    }
    const providerMessages = fitContextCompactionSummaryInput({
      essentialOnly: attempt === SUMMARY_ATTEMPT_SOURCE_MAX_CHARS.length,
      maxInputTokens: params.maxInputTokens,
      messages: selectContextCompactionAttemptMessages(params.messages, attempt),
      sourceMaxChars: SUMMARY_ATTEMPT_SOURCE_MAX_CHARS[attempt - 1],
      targetSummaryTokens: params.targetSummaryTokens,
    });
    const inputTokens = estimateInputTokens(providerMessages);
    if (inputTokens >= previousInputTokens) {
      return this.failedAttempt({
        calledProvider: false,
        failure: `semantic retry input did not shrink: ${inputTokens} tokens is not below ${previousInputTokens}`,
        inputTokens,
      });
    }
    const response = await this.requestProvider({
      attempt,
      messages: providerMessages,
      params,
    });
    const finishReason = response.finishReason.trim().toLowerCase();
    const summary = response.content ? normalizeContextCompactionSummary(response.content) : "";
    const base = {
      calledProvider: true,
      finishReason: response.finishReason,
      inputTokens,
      providerUsage: response.usage,
      rawSummaryTokens: summary ? estimateInputTokens(summary) : 0,
    };
    if (!NATURAL_SUMMARY_FINISH_REASONS.has(finishReason)
      && !TRUNCATED_SUMMARY_FINISH_REASONS.has(finishReason)) {
      return this.failedAttempt({ ...base, failure: `unsupported finishReason=${response.finishReason}` });
    }
    if (!summary) {
      return this.failedAttempt({ ...base, failure: `empty summary: finishReason=${response.finishReason}` });
    }
    const validation = validateContextCompactionSummary({ summary });
    if (!validation.summary) {
      return this.failedAttempt({
        ...base,
        failure: `${TRUNCATED_SUMMARY_FINISH_REASONS.has(finishReason) ? "truncated" : "incomplete"} summary; missing essential sections: ${validation.missingEssentialSections.join(", ")}`,
      });
    }
    const installableSummary = fitContextCompactionSummaryOutput({
      maxInstallableSummaryTokens: params.maxInstallableSummaryTokens,
      summary: validation.summary,
    });
    if (!installableSummary) {
      return this.failedAttempt({
        ...base,
        failure: `complete essential prefix exceeds hard installable budget ${params.maxInstallableSummaryTokens}`,
      });
    }
    return {
      ...base,
      degraded: TRUNCATED_SUMMARY_FINISH_REASONS.has(finishReason)
        || validation.summary !== summary
        || installableSummary !== validation.summary,
      failure: "",
      summary: installableSummary,
    };
  };

  private requestProvider = async (input: {
    attempt: number;
    messages: Record<string, unknown>[];
    params: SummaryGenerationRequest;
  }): Promise<Awaited<ReturnType<LlmProviderRuntime["chat"]>>> => {
    try {
      return await this.providerManager!.chat({
        model: input.params.model,
        maxTokens: input.params.maxTokens,
        messages: input.messages,
        signal: input.params.signal,
        thinkingLevel: "off",
      });
    } catch (error) {
      if (input.params.signal?.aborted
        || (error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Context compaction summary provider failed on call ${input.attempt}: ${detail}. The previous checkpoint was kept unchanged.`,
        { cause: error },
      );
    }
  };

  private failedAttempt = (input: Partial<SummaryAttemptResult> & {
    calledProvider: boolean;
    failure: string;
    inputTokens: number;
  }): SummaryAttemptResult => ({
    calledProvider: input.calledProvider,
    degraded: false,
    failure: input.failure,
    finishReason: input.finishReason ?? "unknown",
    inputTokens: input.inputTokens,
    providerUsage: input.providerUsage ?? {},
    rawSummaryTokens: input.rawSummaryTokens ?? 0,
    summary: null,
  });

  private buildGeneratedSummary = (input: {
    attemptCount: number;
    degraded: boolean;
    finishReason: string;
    inputTokens: number;
    providerUsage: Record<string, number>;
    rawSummaryTokens: number;
    recovery: NonNullable<ContextCompactionCheckpoint["summaryDiagnostics"]>["recovery"];
    request: SummaryGenerationRequest;
    summary: string;
  }): GeneratedCompactionSummary => ({
    diagnostics: {
      attemptCount: input.attemptCount,
      degraded: input.degraded,
      finishReason: input.finishReason,
      installedSummaryTokens: estimateInputTokens(input.summary),
      providerInputTokens: input.inputTokens,
      providerMaxOutputTokens: input.request.maxTokens,
      providerUsage: structuredClone(input.providerUsage),
      rawSummaryTokens: input.rawSummaryTokens,
      recovery: input.recovery,
      targetSummaryTokens: input.request.targetSummaryTokens,
    },
    summary: input.summary,
  });
}
