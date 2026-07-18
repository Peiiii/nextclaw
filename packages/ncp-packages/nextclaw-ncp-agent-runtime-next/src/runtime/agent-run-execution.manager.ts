import {
  createNcpEndpointEvent,
  NCP_AI_EXECUTION_METADATA_KEY,
  NcpEventType,
  type NcpAiExecutionMetadata,
  type NcpAiExecutionOutcome,
  type NcpAiExecutionUsage,
  type NcpEndpointEvent,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentRunSpec } from "./types/agent-model-input.types.js";

type ReportedUsage = Pick<
  NcpAiExecutionUsage,
  "cachedInputTokens" | "inputTokens" | "outputTokens" | "totalTokens"
>;

function readTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function readUsageTokenCount(
  usage: Record<string, unknown>,
  primaryKey: string,
  fallbackKey: string,
): number | null {
  return (
    readTokenCount(usage[primaryKey]) ?? readTokenCount(usage[fallbackKey])
  );
}

function normalizeUsage(
  rawUsage: OpenAIChatChunk["usage"],
): ReportedUsage | null {
  if (!rawUsage || Object.keys(rawUsage).length === 0) {
    return null;
  }
  const usage = rawUsage as Record<string, unknown>;
  const inputTokens = readUsageTokenCount(
    usage,
    "prompt_tokens",
    "input_tokens",
  );
  const outputTokens = readUsageTokenCount(
    usage,
    "completion_tokens",
    "output_tokens",
  );
  const explicitTotalTokens = readTokenCount(usage.total_tokens);
  const cachedInputTokens = Object.entries(usage)
    .filter(([key]) => key.endsWith("cached_tokens"))
    .reduce<number | null>((maximum, [, value]) => {
      const count = readTokenCount(value);
      if (count === null) return maximum;
      return maximum === null ? count : Math.max(maximum, count);
    }, null);
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens:
      explicitTotalTokens ??
      (inputTokens !== null && outputTokens !== null
        ? inputTokens + outputTokens
        : null),
  };
}

function sumReportedUsage(
  usages: readonly ReportedUsage[],
  key: keyof ReportedUsage,
): number | null {
  const values = usages.flatMap((usage) =>
    usage[key] === null ? [] : [usage[key]],
  );
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

export class AgentRunExecutionManager {
  private modelCallCount = 0;
  private readonly reportedUsages: ReportedUsage[] = [];

  constructor(
    private readonly run: {
      spec: DefaultNcpAgentRunSpec;
      sessionId: string;
      messageId: string;
    },
  ) {}

  observeModelCall = async function* (
    this: AgentRunExecutionManager,
    stream: AsyncIterable<OpenAIChatChunk>,
  ): AsyncIterable<OpenAIChatChunk> {
    this.modelCallCount += 1;
    let reportedUsage: ReportedUsage | null = null;
    try {
      for await (const chunk of stream) {
        reportedUsage = normalizeUsage(chunk.usage) ?? reportedUsage;
        yield chunk;
      }
    } finally {
      if (reportedUsage) {
        this.reportedUsages.push(reportedUsage);
      }
    }
  };

  buildMetadata = (outcome: NcpAiExecutionOutcome): NcpAiExecutionMetadata => {
    const { spec } = this.run;
    const reportedModelCallCount = this.reportedUsages.length;
    const status =
      reportedModelCallCount === 0
        ? "unavailable"
        : reportedModelCallCount === this.modelCallCount
          ? "reported"
          : "partial";
    return {
      version: 1,
      runId: spec.runId,
      runtimeId: spec.runtimeId,
      model: spec.model,
      requestedModel: spec.requestedModel,
      outcome,
      usage: {
        inputTokens: sumReportedUsage(this.reportedUsages, "inputTokens"),
        outputTokens: sumReportedUsage(this.reportedUsages, "outputTokens"),
        cachedInputTokens: sumReportedUsage(
          this.reportedUsages,
          "cachedInputTokens",
        ),
        totalTokens: sumReportedUsage(this.reportedUsages, "totalTokens"),
        modelCallCount: this.modelCallCount,
        reportedModelCallCount,
        status,
      },
    };
  };

  buildRunMetadata = (
    outcome: NcpAiExecutionOutcome,
  ): Record<string, unknown> => ({
    [NCP_AI_EXECUTION_METADATA_KEY]: this.buildMetadata(outcome),
  });

  createMetadataEvent = (params: {
    outcome: NcpAiExecutionOutcome;
    occurredAt?: string;
  }): NcpEndpointEvent => {
    const { occurredAt, outcome } = params;
    const { messageId, sessionId, spec } = this.run;
    return createNcpEndpointEvent(
      {
        type: NcpEventType.RunMetadata,
        payload: {
          messageId,
          runId: spec.runId,
          sessionId,
          correlationId: spec.correlationId,
          metadata: this.buildRunMetadata(outcome),
        },
      },
      occurredAt,
    );
  };
}
