export const NCP_AI_EXECUTION_METADATA_KEY = "ai_execution";

export type NcpAiExecutionOutcome = "completed" | "failed" | "aborted";

export type NcpAiExecutionUsageStatus = "reported" | "partial" | "unavailable";

export type NcpAiExecutionUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  totalTokens: number | null;
  modelCallCount: number | null;
  reportedModelCallCount: number | null;
  status: NcpAiExecutionUsageStatus;
};

export type NcpAiExecutionMetadata = {
  version: 1;
  runId: string;
  runtimeId: string;
  model: string;
  requestedModel: string | null;
  outcome: NcpAiExecutionOutcome;
  usage: NcpAiExecutionUsage;
};

export function createUnavailableNcpAiExecutionMetadata(params: {
  runId: string;
  runtimeId: string;
  model: string;
  requestedModel: string | null;
  outcome: NcpAiExecutionOutcome;
}): NcpAiExecutionMetadata {
  const { model, outcome, requestedModel, runId, runtimeId } = params;
  return {
    version: 1,
    runId,
    runtimeId,
    model,
    requestedModel,
    outcome,
    usage: {
      inputTokens: null,
      outputTokens: null,
      cachedInputTokens: null,
      totalTokens: null,
      modelCallCount: null,
      reportedModelCallCount: null,
      status: "unavailable",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableTokenCount(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  );
}

function isUsageStatus(value: unknown): value is NcpAiExecutionUsageStatus {
  return value === "reported" || value === "partial" || value === "unavailable";
}

function isOutcome(value: unknown): value is NcpAiExecutionOutcome {
  return value === "completed" || value === "failed" || value === "aborted";
}

export function readNcpAiExecutionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): NcpAiExecutionMetadata | null {
  const candidate = metadata?.[NCP_AI_EXECUTION_METADATA_KEY];
  if (
    !isRecord(candidate) ||
    candidate.version !== 1 ||
    !isRecord(candidate.usage)
  ) {
    return null;
  }
  const usage = candidate.usage;
  if (
    typeof candidate.runId !== "string" ||
    !candidate.runId.trim() ||
    typeof candidate.runtimeId !== "string" ||
    !candidate.runtimeId.trim() ||
    typeof candidate.model !== "string" ||
    !candidate.model.trim() ||
    !(
      candidate.requestedModel === null ||
      typeof candidate.requestedModel === "string"
    ) ||
    !isOutcome(candidate.outcome) ||
    !isNullableTokenCount(usage.inputTokens) ||
    !isNullableTokenCount(usage.outputTokens) ||
    !isNullableTokenCount(usage.cachedInputTokens) ||
    !isNullableTokenCount(usage.totalTokens) ||
    !isNullableTokenCount(usage.modelCallCount) ||
    !isNullableTokenCount(usage.reportedModelCallCount) ||
    !isUsageStatus(usage.status)
  ) {
    return null;
  }
  return candidate as NcpAiExecutionMetadata;
}
