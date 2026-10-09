export type ContextCompactionPhase = "pre-run" | "mid-run";

export type ContextCompactionCheckpoint = {
  version: 1;
  id: string;
  status: "compressing" | "compressed" | "failed" | "cancelled";
  phase?: ContextCompactionPhase;
  summary: string;
  coveredUntil?: string;
  continuationMessageId?: string;
  continuationMessageCoveredPartCount?: number;
  preservedUserMessageIds?: string[];
  retainedMessageIds?: string[];
  retainedMessagePartStarts?: Record<string, number>;
  retainedMessagePartEnds?: Record<string, number>;
  truncatedPreservedUserMessage?: {
    messageId: string;
    text: string;
  };
  coveredMessageCount: number;
  coveredSessionMessageCount: number;
  originalEstimatedTokens: number;
  projectedEstimatedTokens: number;
  summaryDiagnostics?: {
    attemptCount: number;
    degraded: boolean;
    finishReason: string;
    installedSummaryTokens: number;
    providerInputTokens: number;
    providerMaxOutputTokens: number;
    providerUsage: Record<string, number>;
    rawSummaryTokens: number;
    recovery: "provider-summary" | "deterministic-recent-context";
    targetSummaryTokens: number;
    sourceBatchCount?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export function readCompressedContextCompactionCheckpoint(value: unknown): ContextCompactionCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const checkpoint = value as Partial<ContextCompactionCheckpoint>;
  return checkpoint.version === 1 && checkpoint.status === "compressed" && typeof checkpoint.summary === "string"
    ? checkpoint as ContextCompactionCheckpoint
    : null;
}
