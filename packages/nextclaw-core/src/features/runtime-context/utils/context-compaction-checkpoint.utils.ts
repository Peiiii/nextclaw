export type ContextCompactionPhase = "pre-run" | "mid-run";

export type ContextCompactionCheckpoint = {
  version: 1 | 2;
  id: string;
  status: "compressing" | "compressed" | "failed" | "cancelled";
  phase?: ContextCompactionPhase;
  summary: string;
  source?: {
    journalWatermark: number;
    ranges: { from: number; to: number }[];
    revisionDigest: string;
    sourceCount: number;
    omittedRangeCount: number;
    semanticRevision: number;
    journalGeneration?: string;
  };
  recovery?: {
    required: true;
    reason: "summary-unavailable" | "unresolved-archive";
    archiveThrough: string;
    checkpointId?: string;
  };
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
    sourceTruncated?: boolean;
    failure?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export function readCompressedContextCompactionCheckpoint(value: unknown): ContextCompactionCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const checkpoint = value as Partial<ContextCompactionCheckpoint>;
  const source = checkpoint.source;
  if (checkpoint.version === 2 && (!source || !Array.isArray(source.ranges) || source.ranges.length > 16
    || !/^[a-f0-9]{64}$/.test(source.revisionDigest) || !Number.isSafeInteger(source.journalWatermark) || source.journalWatermark < 0
    || !Number.isSafeInteger(source.semanticRevision) || source.semanticRevision < 0
    || (source.journalGeneration !== undefined && (typeof source.journalGeneration !== "string" || source.journalGeneration.length > 256))
    || !Number.isSafeInteger(source.sourceCount) || source.sourceCount < 0 || source.sourceCount > 256
    || !Number.isSafeInteger(source.omittedRangeCount) || source.omittedRangeCount < 0
    || source.ranges.some(range => !Number.isSafeInteger(range.from) || !Number.isSafeInteger(range.to)
      || range.from < 1 || range.to < range.from || range.to - range.from >= 256)
    || source.ranges.reduce((count, range) => count + range.to - range.from + 1, 0) !== source.sourceCount
    || source.ranges.some((range, index) => index > 0 && range.from <= source.ranges[index - 1]!.to))) return null;
  const recovery = checkpoint.recovery;
  if (recovery && (recovery.required !== true || typeof recovery.archiveThrough !== "string"
    || (recovery.checkpointId !== undefined && typeof recovery.checkpointId !== "string")
    || !["summary-unavailable", "unresolved-archive"].includes(recovery.reason))) return null;
  return (checkpoint.version === 1 || checkpoint.version === 2) && checkpoint.status === "compressed" && typeof checkpoint.summary === "string"
    ? checkpoint as ContextCompactionCheckpoint
    : null;
}

/** Bounded public status; source manifests and model-only context stay with the checkpoint owner. */
export function projectContextCompactionStatus(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const checkpoint = value as Record<string, unknown>;
  const status: Record<string, unknown> = {};
  for (const field of ["id", "status", "phase", "continuationMessageId", "createdAt", "updatedAt"]) {
    if (typeof checkpoint[field] === "string" && checkpoint[field].length <= 1_024) status[field] = checkpoint[field];
  }
  for (const field of ["continuationMessageCoveredPartCount", "coveredMessageCount", "coveredSessionMessageCount", "originalEstimatedTokens", "projectedEstimatedTokens"]) {
    if (Number.isSafeInteger(checkpoint[field]) && Number(checkpoint[field]) >= 0) status[field] = checkpoint[field];
  }
  return status;
}
