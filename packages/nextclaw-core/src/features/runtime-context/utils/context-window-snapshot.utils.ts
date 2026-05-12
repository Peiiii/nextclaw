import type { ContextCompactionCheckpoint } from "@core/features/runtime-context/services/context-compaction.service.js";

export type ContextWindowSnapshot = {
  version: 1;
  usedContextTokens: number;
  totalContextTokens: number;
  prunedUsedContextTokens: number;
  availableContextTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
  compacted: boolean;
  checkpointId?: string;
  compactedMessageCount: number;
  compactedUsedContextTokens?: number;
  updatedAt: string;
};

export function buildContextWindowSnapshot(params: {
  usedContextTokens: number;
  totalContextTokens: number;
  prunedUsedContextTokens: number;
  droppedHistoryCount: number;
  truncatedToolResultCount: number;
  truncatedSystemPrompt: boolean;
  truncatedUserMessage: boolean;
  checkpoint: ContextCompactionCheckpoint | null;
  compactedUsedContextTokens?: number;
  now?: Date;
}): ContextWindowSnapshot {
  const {
    checkpoint,
    compactedUsedContextTokens,
    droppedHistoryCount,
    prunedUsedContextTokens,
    totalContextTokens,
    truncatedSystemPrompt,
    truncatedToolResultCount,
    truncatedUserMessage,
    usedContextTokens,
  } = params;
  return {
    version: 1,
    usedContextTokens,
    totalContextTokens,
    prunedUsedContextTokens,
    availableContextTokens: Math.max(0, totalContextTokens - usedContextTokens),
    droppedHistoryCount,
    truncatedToolResultCount,
    truncatedSystemPrompt,
    truncatedUserMessage,
    compacted: Boolean(checkpoint),
    ...(checkpoint
      ? {
          checkpointId: checkpoint.id,
          compactedMessageCount: checkpoint.coveredMessageCount,
          compactedUsedContextTokens,
        }
      : {
          compactedMessageCount: 0,
        }),
    updatedAt: (params.now ?? new Date()).toISOString(),
  };
}

export function buildCompressingCompactionCheckpoint(previousValue: unknown): ContextCompactionCheckpoint {
  const previous =
    previousValue && typeof previousValue === "object" && !Array.isArray(previousValue)
      ? (previousValue as Partial<ContextCompactionCheckpoint>)
      : null;
  const now = new Date().toISOString();
  return {
    version: 1,
    id: typeof previous?.id === "string" ? previous.id : `ctx-${Date.now()}`,
    status: "compressing",
    summary:
      typeof previous?.summary === "string" && previous.summary.trim().length > 0
        ? previous.summary
        : "Compressing earlier context for the next model request.",
    coveredMessageCount: typeof previous?.coveredMessageCount === "number" ? previous.coveredMessageCount : 0,
    coveredSessionMessageCount:
      typeof previous?.coveredSessionMessageCount === "number" ? previous.coveredSessionMessageCount : 0,
    originalEstimatedTokens:
      typeof previous?.originalEstimatedTokens === "number" ? previous.originalEstimatedTokens : 0,
    projectedEstimatedTokens:
      typeof previous?.projectedEstimatedTokens === "number" ? previous.projectedEstimatedTokens : 0,
    createdAt: typeof previous?.createdAt === "string" ? previous.createdAt : now,
    updatedAt: now,
  };
}
