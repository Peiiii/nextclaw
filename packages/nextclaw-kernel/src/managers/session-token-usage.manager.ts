import type { NcpAiExecutionMetadata, NcpMessage } from "@nextclaw/ncp";
import { readNcpAiExecutionMetadata } from "@nextclaw/ncp";
import type {
  SessionModelTokenUsage,
  SessionTokenUsageStatus,
  SessionTokenUsageSummary,
  SessionTokenUsageTotals
} from "@kernel/types/session.types.js";

const INHERITED_FROM_SESSION_METADATA_KEY = "inherited_from_session_id";

type SessionExecutionUsage = NcpAiExecutionMetadata["usage"];
type SessionExecutionTokenMetric = keyof Pick<
  SessionExecutionUsage,
  "inputTokens" | "outputTokens" | "cachedInputTokens" | "totalTokens"
>;

function sumNullableUsageMetric(
  executions: readonly NcpAiExecutionMetadata[],
  metric: SessionExecutionTokenMetric | "modelCallCount" | "reportedModelCallCount"
): number | null {
  const values = executions.flatMap((execution) => {
    const value = execution.usage[metric];
    return value === null ? [] : [value];
  });
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
}

function buildTokenUsageTotals(executions: readonly NcpAiExecutionMetadata[]): SessionTokenUsageTotals {
  const inputTokens = sumNullableUsageMetric(executions, "inputTokens");
  const cachedInputTokens = sumNullableUsageMetric(executions, "cachedInputTokens");
  const hasCompleteCacheUsage = executions.length > 0 && executions.every(
    (execution) => execution.usage.inputTokens !== null && execution.usage.cachedInputTokens !== null
  );
  return {
    inputTokens,
    outputTokens: sumNullableUsageMetric(executions, "outputTokens"),
    cachedInputTokens,
    totalTokens: sumNullableUsageMetric(executions, "totalTokens"),
    cacheHitRate:
      hasCompleteCacheUsage &&
      inputTokens !== null &&
      inputTokens > 0 &&
      cachedInputTokens !== null &&
      cachedInputTokens <= inputTokens
        ? cachedInputTokens / inputTokens
        : null
  };
}

function resolveTokenUsageStatus(executions: readonly NcpAiExecutionMetadata[]): SessionTokenUsageStatus {
  if (executions.length === 0 || executions.every((execution) => execution.usage.status === "unavailable")) {
    return "unavailable";
  }
  return executions.every((execution) => execution.usage.status === "reported") ? "reported" : "partial";
}

function buildModelTokenUsage(
  model: string,
  executions: readonly NcpAiExecutionMetadata[]
): SessionModelTokenUsage {
  return {
    model,
    ...buildTokenUsageTotals(executions),
    runCount: executions.length,
    modelCallCount: sumNullableUsageMetric(executions, "modelCallCount"),
    reportedModelCallCount: sumNullableUsageMetric(executions, "reportedModelCallCount"),
    status: resolveTokenUsageStatus(executions)
  };
}

export function buildSessionTokenUsageSummary(params: {
  sessionId: string;
  messages: readonly NcpMessage[];
}): SessionTokenUsageSummary {
  const executionsByRunId = new Map<string, NcpAiExecutionMetadata>();
  for (const message of params.messages) {
    if (
      message.role !== "assistant" ||
      typeof message.metadata?.[INHERITED_FROM_SESSION_METADATA_KEY] === "string"
    ) {
      continue;
    }
    const execution = readNcpAiExecutionMetadata(message.metadata);
    if (execution) {
      executionsByRunId.set(execution.runId, execution);
    }
  }
  const executions = [...executionsByRunId.values()];
  const executionsByModel = new Map<string, NcpAiExecutionMetadata[]>();
  for (const execution of executions) {
    const modelExecutions = executionsByModel.get(execution.model) ?? [];
    modelExecutions.push(execution);
    executionsByModel.set(execution.model, modelExecutions);
  }
  const models = [...executionsByModel.entries()]
    .map(([model, modelExecutions]) => buildModelTokenUsage(model, modelExecutions))
    .sort((left, right) => {
      const leftTotal = left.totalTokens ?? -1;
      const rightTotal = right.totalTokens ?? -1;
      return rightTotal === leftTotal ? left.model.localeCompare(right.model) : rightTotal - leftTotal;
    });
  return {
    sessionId: params.sessionId,
    totals: buildTokenUsageTotals(executions),
    models,
    runCount: executions.length,
    modelCallCount: sumNullableUsageMetric(executions, "modelCallCount"),
    reportedModelCallCount: sumNullableUsageMetric(executions, "reportedModelCallCount"),
    status: resolveTokenUsageStatus(executions)
  };
}
