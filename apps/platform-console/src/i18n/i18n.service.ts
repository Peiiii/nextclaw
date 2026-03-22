import enUs from '@/i18n/locales/en-US.json';
import zhCn from '@/i18n/locales/zh-CN.json';

export const supportedLocales = ['zh-CN', 'en-US'] as const;

export type LocaleCode = (typeof supportedLocales)[number];

interface MessageTree {
  [key: string]: string | MessageTree;
}

type MessageValue = string | MessageTree;
type MessageParams = Record<string, string | number>;

const messageCatalog: Record<LocaleCode, MessageTree> = {
  'zh-CN': zhCn as MessageTree,
  'en-US': enUs as MessageTree
};

function readMessageValue(tree: MessageTree, key: string): string | null {
  const segments = key.split('.');
  let current: MessageValue = tree;
  for (const segment of segments) {
    if (!current || typeof current === 'string' || !(segment in current)) {
      return null;
    }
    current = current[segment] as MessageValue;
  }
  return typeof current === 'string' ? current : null;
}

function interpolateMessage(template: string, params?: MessageParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function resolveLocale(input?: string | null): LocaleCode {
  const normalized = (input ?? '').trim().toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }
  if (normalized.startsWith('en')) {
    return 'en-US';
  }
  return 'en-US';
}

export function createTranslator(locale: LocaleCode) {
  return (key: string, params?: MessageParams): string => {
    const localized = readMessageValue(messageCatalog[locale], key);
    const fallback = locale === 'en-US' ? null : readMessageValue(messageCatalog['en-US'], key);
    const resolved = localized ?? fallback ?? key;
    return interpolateMessage(resolved, params);
  };
}

export function formatDateTime(locale: LocaleCode, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}
