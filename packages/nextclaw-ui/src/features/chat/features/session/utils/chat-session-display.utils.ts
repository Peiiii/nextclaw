import type { SessionActivityPreviewView, SessionEntryView } from '@/shared/lib/api';
import { getLanguage, getLocale, t, type I18nLanguage } from '@/shared/lib/i18n';

const LEGACY_ACTIVITY_STATUS_LABELS: Array<[
  string,
  NonNullable<SessionActivityPreviewView['statusKind']>
]> = [
  ['Thinking', 'thinking'],
  ['Calling tool', 'tool-running'],
  ['Tool call completed', 'tool-completed'],
  ['Run failed', 'run-failed'],
  ['Run interrupted', 'run-interrupted']
];

export function sessionDisplayName(session: SessionEntryView): string {
  const label = session.label?.trim();
  if (label) {
    return label;
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

function formatSessionActivityStatus(
  preview: SessionActivityPreviewView,
  lang: I18nLanguage
): string | null {
  const detail = preview.statusText?.trim();
  const legacyStatus = preview.statusKind || !detail
    ? undefined
    : LEGACY_ACTIVITY_STATUS_LABELS.find(([label]) => detail === label || detail.startsWith(`${label}: `));
  const statusKind = preview.statusKind ?? legacyStatus?.[1];
  const localizedDetail = legacyStatus
    ? detail?.slice(legacyStatus[0].length).replace(/^:\s*/, '') || undefined
    : detail;
  switch (statusKind) {
    case 'thinking':
      return t('chatTyping', lang);
    case 'tool-running':
      return [t('chatToolCall', lang), t('chatToolStatusRunning', lang), localizedDetail].filter(Boolean).join(' · ');
    case 'tool-completed':
      return [t('chatToolCall', lang), t('chatToolStatusCompleted', lang), localizedDetail].filter(Boolean).join(' · ');
    case 'run-failed':
      return [t('chatToolStatusFailed', lang), localizedDetail].filter(Boolean).join(' · ');
    case 'run-interrupted':
      return t('chatSessionActivityInterrupted', lang);
    default:
      return localizedDetail ?? null;
  }
}

export function sessionActivityPreviewText(
  session: SessionEntryView,
  lang: I18nLanguage = getLanguage()
): string | null {
  const preview = session.activityPreview;
  if (!preview || preview.state === 'cancelled') {
    return null;
  }
  if (preview.state === 'completed' && preview.replyText) {
    return preview.replyText;
  }
  return formatSessionActivityStatus(preview, lang) ?? preview.replyText ?? null;
}

function startOfLocalDate(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isSameLocalYear(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear();
}

function formatChineseSessionDate(date: Date, now: Date): string {
  const monthDay = `${date.getMonth() + 1}月${date.getDate()}日`;
  return isSameLocalYear(date, now) ? monthDay : `${date.getFullYear()}年${monthDay}`;
}

export function formatSessionListTime(
  value?: string | Date,
  lang: I18nLanguage = getLanguage(),
  now: Date = new Date()
): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }

  const locale = getLocale(lang);
  const dateStart = startOfLocalDate(date);
  const todayStart = startOfLocalDate(now);
  const daysAgo = Math.floor((todayStart - dateStart) / 86_400_000);

  if (daysAgo === 0) {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  if (daysAgo === 1) {
    return t('chatSidebarYesterday', lang);
  }

  if (daysAgo > 1 && daysAgo < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  }

  if (lang === 'zh') {
    return formatChineseSessionDate(date, now);
  }

  const options: Intl.DateTimeFormatOptions = isSameLocalYear(date, now)
    ? { month: 'numeric', day: 'numeric' }
    : { year: 'numeric', month: 'numeric', day: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(date);
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
