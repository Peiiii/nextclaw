export type LlmUsageSummary = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheHit: boolean;
  cacheMetricKeys: string[];
};

export type LlmUsageRecord = {
  version: 1;
  observedAt: string;
  source: string;
  model: string | null;
  usage: Record<string, number>;
  summary: LlmUsageSummary;
};

export type LlmUsageSnapshot = LlmUsageRecord;

export function createLlmUsageRecord(params: {
  observedAt?: string;
  source: string;
  model?: string | null;
  usage: Record<string, number>;
}): LlmUsageRecord {
  const { observedAt, source, model, usage: rawUsage } = params;
  const usage = sanitizeLlmUsage(rawUsage);
  return {
    version: 1,
    observedAt: observedAt ?? new Date().toISOString(),
    source,
    model: normalizeLlmUsageModel(model),
    usage,
    summary: buildLlmUsageSummary(usage),
  };
}

export function sanitizeLlmUsage(
  usage: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(usage)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      continue;
    }
    next[key] = Math.floor(value);
  }
  return next;
}

export function hasLlmUsageTelemetry(usage: Record<string, number>): boolean {
  return Object.keys(usage).length > 0;
}

export function buildLlmUsageSummary(
  usage: Record<string, number>,
): LlmUsageSummary {
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
  const cacheMetricKeys = Object.keys(usage).filter((key) =>
    key.endsWith("cached_tokens")
  );
  const cachedTokens = cacheMetricKeys.reduce(
    (max, key) => Math.max(max, usage[key] ?? 0),
    0,
  );
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens,
    cacheHit: cachedTokens > 0,
    cacheMetricKeys,
  };
}

export function normalizeLlmUsageModel(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
