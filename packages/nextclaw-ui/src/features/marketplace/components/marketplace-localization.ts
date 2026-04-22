import type { MarketplaceInstalledRecord, MarketplaceLocalizedTextMap } from '@/shared/lib/api';

export function buildLocaleFallbacks(language: string): string[] {
  const normalized = language.trim().toLowerCase().replace(/_/g, '-');
  const base = normalized.split('-')[0];
  const fallbacks = [normalized, base, 'en'];
  return Array.from(new Set(fallbacks.filter(Boolean)));
}

export function normalizeLocaleTag(locale: string): string {
  return locale.trim().toLowerCase().replace(/_/g, '-');
}

export function pickLocalizedText(
  localized: MarketplaceLocalizedTextMap | undefined,
  fallback: string | undefined,
  localeFallbacks: string[]
): string {
  if (localized) {
    const entries = Object.entries(localized)
      .map(([locale, text]) => ({ locale: normalizeLocaleTag(locale), text: typeof text === 'string' ? text.trim() : '' }))
      .filter((entry) => entry.text.length > 0);

    if (entries.length > 0) {
      const exactMap = new Map(entries.map((entry) => [entry.locale, entry.text] as const));

      for (const locale of localeFallbacks) {
        const normalizedLocale = normalizeLocaleTag(locale);
        const exact = exactMap.get(normalizedLocale);
        if (exact) {
          return exact;
        }
      }

      for (const locale of localeFallbacks) {
        const base = normalizeLocaleTag(locale).split('-')[0];
        if (!base) {
          continue;
        }
        const matched = entries.find((entry) => entry.locale === base || entry.locale.startsWith(`${base}-`));
        if (matched) {
          return matched.text;
        }
      }

      return entries[0]?.text ?? '';
    }
  }

  return fallback?.trim() ?? '';
}

export function pickInstalledRecordDescription(
  record: MarketplaceInstalledRecord | undefined,
  localeFallbacks: string[]
): string {
  if (!record) {
    return '';
  }

  for (const locale of localeFallbacks) {
    const base = normalizeLocaleTag(locale).split('-')[0];
    if (base === 'zh' && record.descriptionZh?.trim()) {
      return record.descriptionZh.trim();
    }
  }

  if (record.description?.trim()) {
    return record.description.trim();
  }

  if (record.descriptionZh?.trim()) {
    return record.descriptionZh.trim();
  }

  return '';
}
