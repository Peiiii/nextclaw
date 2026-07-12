import type { ChatFilePreviewViewer } from '@nextclaw/agent-chat-ui';
import type { ChatWorkspaceFileTab } from '@/features/chat/stores/chat-thread.store';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function normalizeFilePreviewViewer(value: unknown): ChatFilePreviewViewer | null {
  return value === 'auto' || value === 'source' || value === 'rendered'
    ? value
    : null;
}

export function normalizePersistedWorkspaceFileTab(
  value: unknown,
): ChatWorkspaceFileTab | null {
  if (
    !isRecord(value)
    || typeof value.key !== 'string'
    || typeof value.path !== 'string'
    || (value.viewMode !== 'preview' && value.viewMode !== 'diff')
  ) {
    return null;
  }
  const key = value.key.trim();
  const path = value.path.trim();
  if (!key || !path) {
    return null;
  }
  return {
    key,
    parentSessionKey: normalizeOptionalString(value.parentSessionKey),
    path,
    label: normalizeOptionalString(value.label),
    viewMode: value.viewMode,
    previewViewer: normalizeFilePreviewViewer(value.previewViewer),
    line: normalizeOptionalNumber(value.line),
    column: normalizeOptionalNumber(value.column),
    rawText: normalizeOptionalText(value.rawText),
    contentUrl: normalizeOptionalString(value.contentUrl),
    mimeType: normalizeOptionalString(value.mimeType),
    beforeText: normalizeOptionalText(value.beforeText),
    afterText: normalizeOptionalText(value.afterText),
    patchText: normalizeOptionalText(value.patchText),
    oldStartLine: normalizeOptionalNumber(value.oldStartLine),
    newStartLine: normalizeOptionalNumber(value.newStartLine),
  };
}

export function toPersistedWorkspaceFileTab(
  tab: ChatWorkspaceFileTab,
): ChatWorkspaceFileTab {
  return {
    key: tab.key,
    parentSessionKey: tab.parentSessionKey,
    path: tab.path,
    label: tab.label,
    viewMode: tab.viewMode,
    previewViewer: tab.previewViewer,
    line: tab.line,
    column: tab.column,
    rawText: tab.rawText,
    contentUrl: tab.contentUrl,
    mimeType: tab.mimeType,
    beforeText: tab.beforeText,
    afterText: tab.afterText,
    patchText: tab.patchText,
    oldStartLine: tab.oldStartLine,
    newStartLine: tab.newStartLine,
  };
}
