import type { SessionEntryView } from '@/shared/lib/api';
import { getLanguage, getLocale, t, type I18nLanguage } from '@/shared/lib/i18n';

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
