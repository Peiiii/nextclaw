import type { SessionEntryView } from '@/api/types';

export function sessionDisplayName(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

function normalizeSessionSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

export function sessionMatchesQuery(session: SessionEntryView, query: string): boolean {
  const normalizedQuery = normalizeSessionSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  return [
    session.key,
    sessionDisplayName(session),
    session.projectRoot ?? '',
    session.projectName ?? '',
  ]
    .map(normalizeSessionSearchValue)
    .some((value) => value.includes(normalizedQuery));
}
