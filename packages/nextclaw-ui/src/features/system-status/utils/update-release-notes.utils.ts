import type { UpdateSnapshot } from '@nextclaw/shared';

export type ReleaseNotesLocale = 'zh-CN' | 'en-US';

export type ReleaseNotesText = Partial<Record<ReleaseNotesLocale, string>>;

export type ReleaseNotesItem = {
  title: ReleaseNotesText;
  body?: ReleaseNotesText;
};

export type ReleaseNotesSection = {
  kind: string;
  title?: ReleaseNotesText;
  items: ReleaseNotesItem[];
};

export type ReleaseNotesPayload = {
  title?: ReleaseNotesText;
  summary?: ReleaseNotesText;
  sections: ReleaseNotesSection[];
};

export function readReleaseNotesText(
  value: ReleaseNotesText | undefined,
  locale: ReleaseNotesLocale
): string | null {
  const fallbackLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
  const text = value?.[locale]?.trim() || value?.[fallbackLocale]?.trim();
  return text || null;
}

export function resolveReleaseNotesDataUrl(snapshot: UpdateSnapshot): string | null {
  const releaseNotesUrl = snapshot.releaseNotesUrl?.trim();
  const version = (snapshot.availableVersion ?? snapshot.downloadedVersion)?.trim();
  if (!releaseNotesUrl || !version || !/^[0-9A-Za-z.-]+$/.test(version)) {
    return null;
  }

  try {
    return new URL(`/release-notes/nextclaw-v${version}.json`, releaseNotesUrl).toString();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isReleaseNotesText(value: unknown): value is ReleaseNotesText {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value['zh-CN'] === 'string' || typeof value['en-US'] === 'string';
}

function isReleaseNotesItem(value: unknown): value is ReleaseNotesItem {
  if (!isRecord(value) || !isReleaseNotesText(value.title)) {
    return false;
  }
  return value.body === undefined || isReleaseNotesText(value.body);
}

function isReleaseNotesSection(value: unknown): value is ReleaseNotesSection {
  return isRecord(value)
    && typeof value.kind === 'string'
    && Array.isArray(value.items)
    && value.items.every(isReleaseNotesItem)
    && (value.title === undefined || isReleaseNotesText(value.title));
}

function isReleaseNotesPayload(value: unknown): value is ReleaseNotesPayload {
  return isRecord(value)
    && Array.isArray(value.sections)
    && value.sections.every(isReleaseNotesSection)
    && (value.title === undefined || isReleaseNotesText(value.title))
    && (value.summary === undefined || isReleaseNotesText(value.summary));
}

export async function fetchReleaseNotesData(url: string): Promise<ReleaseNotesPayload> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Release notes request failed with HTTP ${response.status}.`);
  }
  const payload: unknown = await response.json();
  if (!isReleaseNotesPayload(payload)) {
    throw new Error('Release notes payload has an unsupported shape.');
  }
  return payload;
}
