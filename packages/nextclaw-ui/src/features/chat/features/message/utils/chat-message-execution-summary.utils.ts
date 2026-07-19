import type { ChatMessageMoreActionsViewModel } from "@nextclaw/agent-chat-ui";
import {
  readNcpAiExecutionMetadata,
  type NcpAiExecutionMetadata,
  type NcpMessage,
} from "@nextclaw/ncp";

export type ChatMessageExecutionSummaryLabels = {
  input: string;
  output: string;
  tokens: string;
  partial: string;
};

export type ChatMessageExecutionPresentationLabels =
  ChatMessageExecutionSummaryLabels & {
    moreActions: string;
    viewMetadata: string;
    metadataTitle: string;
    metadataDescription: string;
    close: string;
    notAvailable: string;
    fields: {
      runId: string;
      runtime: string;
      model: string;
      requestedModel: string;
      outcome: string;
      inputTokens: string;
      outputTokens: string;
      cachedInputTokens: string;
      totalTokens: string;
      modelCallCount: string;
      reportedModelCallCount: string;
      usageStatus: string;
    };
    outcomes: Record<NcpAiExecutionMetadata["outcome"], string>;
    usageStatuses: Record<NcpAiExecutionMetadata["usage"]["status"], string>;
  };

export type ChatMessageExecutionPresentation = {
  cacheKey: string;
  summaryLabel: string;
  moreActions: ChatMessageMoreActionsViewModel;
};

function formatTokenCount(value: number): string {
  const unit =
    value >= 1_000_000_000
      ? { divisor: 1_000_000_000, suffix: "b" }
      : value >= 1_000_000
        ? { divisor: 1_000_000, suffix: "m" }
        : value >= 1_000
          ? { divisor: 1_000, suffix: "k" }
          : null;
  if (!unit) return String(value);
  const scaled = Math.round((value / unit.divisor) * 10) / 10;
  return `${scaled}${unit.suffix}`;
}

function formatTokenDetail(value: number | null, notAvailable: string): string {
  if (value === null) return notAvailable;
  const compact = formatTokenCount(value);
  return value >= 1_000 ? `${compact} (${value})` : compact;
}

function buildExecutionSummary(
  execution: NcpAiExecutionMetadata,
  labels: ChatMessageExecutionSummaryLabels,
): string {
  const tokenSegments: string[] = [];
  if (execution.usage.inputTokens !== null) {
    tokenSegments.push(
      `${formatTokenCount(execution.usage.inputTokens)} ${labels.input}`,
    );
  }
  if (execution.usage.outputTokens !== null) {
    tokenSegments.push(
      `${formatTokenCount(execution.usage.outputTokens)} ${labels.output}`,
    );
  }
  if (tokenSegments.length === 0 && execution.usage.totalTokens !== null) {
    tokenSegments.push(
      `${formatTokenCount(execution.usage.totalTokens)} ${labels.tokens}`,
    );
  }
  if (tokenSegments.length === 0) {
    return execution.model;
  }
  const summary = `${execution.model} · ${tokenSegments.join(" / ")}`;
  return execution.usage.status === "partial"
    ? `${summary} · ${labels.partial}`
    : summary;
}

export function buildChatMessageExecutionSummary(params: {
  message: Pick<NcpMessage, "metadata" | "role">;
  labels: ChatMessageExecutionSummaryLabels;
}): string | null {
  const { labels, message } = params;
  if (message.role !== "assistant") return null;
  const execution = readNcpAiExecutionMetadata(message.metadata);
  if (!execution) return null;
  return buildExecutionSummary(execution, labels);
}

export function buildChatMessageExecutionPresentation(params: {
  message: Pick<NcpMessage, "metadata" | "role">;
  labels: ChatMessageExecutionPresentationLabels;
}): ChatMessageExecutionPresentation | null {
  const { labels, message } = params;
  if (message.role !== "assistant") return null;
  const execution = readNcpAiExecutionMetadata(message.metadata);
  if (!execution) return null;
  const { usage } = execution;
  const rows = [
    { label: labels.fields.runId, value: execution.runId },
    { label: labels.fields.runtime, value: execution.runtimeId },
    { label: labels.fields.model, value: execution.model },
    {
      label: labels.fields.requestedModel,
      value: execution.requestedModel ?? labels.notAvailable,
    },
    { label: labels.fields.outcome, value: labels.outcomes[execution.outcome] },
    {
      label: labels.fields.inputTokens,
      value: formatTokenDetail(usage.inputTokens, labels.notAvailable),
    },
    {
      label: labels.fields.outputTokens,
      value: formatTokenDetail(usage.outputTokens, labels.notAvailable),
    },
    {
      label: labels.fields.cachedInputTokens,
      value: formatTokenDetail(usage.cachedInputTokens, labels.notAvailable),
    },
    {
      label: labels.fields.totalTokens,
      value: formatTokenDetail(usage.totalTokens, labels.notAvailable),
    },
    {
      label: labels.fields.modelCallCount,
      value: usage.modelCallCount?.toString() ?? labels.notAvailable,
    },
    {
      label: labels.fields.reportedModelCallCount,
      value: usage.reportedModelCallCount?.toString() ?? labels.notAvailable,
    },
    {
      label: labels.fields.usageStatus,
      value: labels.usageStatuses[usage.status],
    },
  ];
  return {
    cacheKey: JSON.stringify(execution),
    summaryLabel: buildExecutionSummary(execution, labels),
    moreActions: {
      triggerLabel: labels.moreActions,
      items: [
        {
          key: "ai-execution-metadata",
          label: labels.viewMetadata,
          dialog: {
            title: labels.metadataTitle,
            description: labels.metadataDescription,
            closeLabel: labels.close,
            rows,
          },
        },
      ],
    },
  };
}
