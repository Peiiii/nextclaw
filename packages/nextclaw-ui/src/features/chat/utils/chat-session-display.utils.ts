import type { SessionEntryView } from '@/shared/lib/api';

export function sessionDisplayName(session: SessionEntryView): string {
  const label = session.label?.trim();
  if (label) {
    return label;
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

export function sessionActivityPreviewText(session: SessionEntryView): string | null {
  const preview = session.activityPreview;
  if (!preview) {
    return null;
  }
  if (preview.state === 'failed' || preview.state === 'running') {
    return preview.statusText ?? preview.replyText ?? null;
  }
  if (preview.state === 'completed') {
    return preview.replyText ?? preview.statusText ?? null;
  }
  return preview.statusText ?? preview.replyText ?? null;
}

function normalizeSessionSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

export function sessionMatchesQuery(session: SessionEntryView, query: string): boolean {
  const normalizedQuery = normalizeSessionSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  return [session.key, sessionDisplayName(session), session.projectRoot ?? '', session.projectName ?? '']
    .map(normalizeSessionSearchValue)
    .some((value) => value.includes(normalizedQuery));
}
