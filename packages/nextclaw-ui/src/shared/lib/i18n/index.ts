import {
  getLanguage,
  getLocale,
  initializeI18n,
  LANGUAGE_OPTIONS,
  resolveInitialLanguage,
  setLanguage,
  subscribeLanguageChange,
  type I18nLanguage
} from './runtime/i18n-language-owner';

export type { I18nLanguage };
export { getLanguage, getLocale, initializeI18n, LANGUAGE_OPTIONS, resolveInitialLanguage, setLanguage, subscribeLanguageChange };

export type MessageCatalog = Record<string, string>;
export type I18nCatalogBundle = Record<I18nLanguage, MessageCatalog>;
type LegacyLabelCatalog = Record<string, Record<I18nLanguage, string>>;

const CATALOGS: I18nCatalogBundle = {
  zh: {},
  en: {},
};

export const LABELS: LegacyLabelCatalog = {};

export function registerI18nCatalogs(bundle: I18nCatalogBundle): void {
  Object.assign(CATALOGS.zh, bundle.zh);
  Object.assign(CATALOGS.en, bundle.en);

  for (const key of new Set([
    ...Object.keys(CATALOGS.zh),
    ...Object.keys(CATALOGS.en),
  ])) {
    LABELS[key] = {
      zh: CATALOGS.zh[key] ?? CATALOGS.en[key] ?? key,
      en: CATALOGS.en[key] ?? key,
    };
  }
}

export async function installMainI18nCatalog(): Promise<void> {
  const catalog = await import('@/shared/lib/i18n/configs/main-i18n-catalog.config');
  catalog.installMainI18nCatalog();
}

export async function installPanelAppI18nCatalog(): Promise<void> {
  const catalog = await import('@/shared/lib/i18n/configs/panel-app-i18n-catalog.config');
  catalog.installPanelAppI18nCatalog();
}

export function formatDateTime(value?: string | Date, lang: I18nLanguage = getLanguage()): string {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }

  return date.toLocaleString(getLocale(lang));
}

export function formatDateShort(value?: string | Date, lang: I18nLanguage = getLanguage()): string {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '-';
  }

  return new Intl.DateTimeFormat(getLocale(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function formatNumber(value: number, lang: I18nLanguage = getLanguage()): string {
  return new Intl.NumberFormat(getLocale(lang)).format(value);
}

export function t(key: string, lang: I18nLanguage = getLanguage()): string {
  return CATALOGS[lang]?.[key] ?? CATALOGS.en[key] ?? key;
}
