import type {
  NcpMessageView,
  NcpSessionSummaryView,
  SessionContextWindowView,
} from '@/shared/lib/api';

const CONTEXT_WINDOW_METADATA_KEY = 'last_context_window';

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readMetadata(summary: NcpSessionSummaryView): Record<string, unknown> | null {
  const { metadata } = summary;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  return metadata as Record<string, unknown>;
}

export function readNcpSessionContextWindow(summary: NcpSessionSummaryView): SessionContextWindowView | null {
  const metadata = readMetadata(summary);
  const rawContextWindow = metadata?.[CONTEXT_WINDOW_METADATA_KEY];
  if (!rawContextWindow || typeof rawContextWindow !== 'object' || Array.isArray(rawContextWindow)) {
    return null;
  }
  const contextWindow = rawContextWindow as Record<string, unknown>;
  const usedContextTokens = readNonNegativeInteger(contextWindow.usedContextTokens);
  const totalContextTokens = readNonNegativeInteger(contextWindow.totalContextTokens);
  const prunedUsedContextTokens = readNonNegativeInteger(contextWindow.prunedUsedContextTokens);
  const updatedAt = readOptionalString(contextWindow.updatedAt);
  if (usedContextTokens === null || totalContextTokens === null || prunedUsedContextTokens === null || !updatedAt) {
    return null;
  }
  const compactedUsedContextTokens = readNonNegativeInteger(contextWindow.compactedUsedContextTokens);
  return {
    usedContextTokens,
    totalContextTokens,
    prunedUsedContextTokens,
    availableContextTokens: readNonNegativeInteger(contextWindow.availableContextTokens) ?? Math.max(0, totalContextTokens - usedContextTokens),
    droppedHistoryCount: readNonNegativeInteger(contextWindow.droppedHistoryCount) ?? 0,
    truncatedToolResultCount: readNonNegativeInteger(contextWindow.truncatedToolResultCount) ?? 0,
    truncatedSystemPrompt: readBoolean(contextWindow.truncatedSystemPrompt),
    truncatedUserMessage: readBoolean(contextWindow.truncatedUserMessage),
    compacted: readBoolean(contextWindow.compacted),
    ...(readOptionalString(contextWindow.checkpointId)
      ? { checkpointId: readOptionalString(contextWindow.checkpointId) ?? undefined }
      : {}),
    compactedMessageCount: readNonNegativeInteger(contextWindow.compactedMessageCount) ?? 0,
    ...(compactedUsedContextTokens !== null
      ? { compactedUsedContextTokens }
      : {}),
    updatedAt,
  };
}

export const NEXTCLAW_TIMELINE_KIND_METADATA_KEY = 'nextclaw_timeline_kind';
export const CONTEXT_COMPACTION_TIMELINE_KIND = 'context_compaction';

export type ContextCompactionTimelineView = {
  id: string;
  status: 'compressing' | 'compressed';
  summary: string;
  coveredMessageCount: number;
  coveredSessionMessageCount: number;
  coveredUntilMessageId?: string;
  originalEstimatedTokens: number;
  projectedEstimatedTokens: number;
  createdAt: string;
  updatedAt: string;
};

export function readContextCompactionTimeline(message: Pick<NcpMessageView, 'metadata'>): ContextCompactionTimelineView | null {
  const metadata = message.metadata;
  if (!metadata || metadata[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] !== CONTEXT_COMPACTION_TIMELINE_KIND) {
    return null;
  }
  const rawCheckpoint =
    metadata.checkpoint && typeof metadata.checkpoint === 'object' && !Array.isArray(metadata.checkpoint)
      ? (metadata.checkpoint as Record<string, unknown>)
      : null;
  if (!rawCheckpoint) {
    return null;
  }
  const id = readOptionalString(rawCheckpoint.id);
  const status = rawCheckpoint.status === 'compressing' ? 'compressing' : rawCheckpoint.status === 'compressed' ? 'compressed' : null;
  const summary = readOptionalString(rawCheckpoint.summary);
  const coveredMessageCount = readNonNegativeInteger(rawCheckpoint.coveredMessageCount);
  const coveredSessionMessageCount = readNonNegativeInteger(rawCheckpoint.coveredSessionMessageCount);
  const originalEstimatedTokens = readNonNegativeInteger(rawCheckpoint.originalEstimatedTokens);
  const projectedEstimatedTokens = readNonNegativeInteger(rawCheckpoint.projectedEstimatedTokens);
  const createdAt = readOptionalString(rawCheckpoint.createdAt);
  const updatedAt = readOptionalString(rawCheckpoint.updatedAt);
  const coveredUntilMessageId = readOptionalString(rawCheckpoint.coveredUntilMessageId) ?? undefined;
  if (
    !id ||
    !status ||
    !summary ||
    coveredMessageCount === null ||
    coveredSessionMessageCount === null ||
    originalEstimatedTokens === null ||
    projectedEstimatedTokens === null ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }
  return {
    id,
    status,
    summary,
    coveredMessageCount,
    coveredSessionMessageCount,
    ...(coveredUntilMessageId ? { coveredUntilMessageId } : {}),
    originalEstimatedTokens,
    projectedEstimatedTokens,
    createdAt,
    updatedAt,
  };
}
