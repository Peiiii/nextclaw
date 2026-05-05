import type { ChatContextWindowIndicator } from '@nextclaw/agent-chat-ui';
import type { SessionContextWindowView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return String(value);
}

export function buildChatContextWindowIndicator(
  contextWindow: SessionContextWindowView | null | undefined
): ChatContextWindowIndicator | null {
  if (!contextWindow || contextWindow.totalContextTokens <= 0) {
    return null;
  }
  const ratio = contextWindow.usedContextTokens / contextWindow.totalContextTokens;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const percentLabel = `${Math.round(clampedRatio * 100)}%`;
  const tone: ChatContextWindowIndicator['tone'] =
    clampedRatio >= 0.9 ? 'danger' : clampedRatio >= 0.75 ? 'warning' : 'neutral';
  return {
    label: t('chatContextWindow'),
    percentLabel,
    ratio: clampedRatio,
    tone,
    details: [
      { label: t('chatContextWindowUsed'), value: formatTokenCount(contextWindow.usedContextTokens) },
      { label: t('chatContextWindowTotal'), value: formatTokenCount(contextWindow.totalContextTokens) },
      { label: t('chatContextWindowAvailable'), value: formatTokenCount(contextWindow.availableContextTokens) },
      { label: t('chatContextWindowPruned'), value: formatTokenCount(contextWindow.prunedUsedContextTokens) },
      { label: t('chatContextWindowDroppedHistory'), value: String(contextWindow.droppedHistoryCount) },
      { label: t('chatContextWindowTruncatedTools'), value: String(contextWindow.truncatedToolResultCount) }
    ]
  };
}
