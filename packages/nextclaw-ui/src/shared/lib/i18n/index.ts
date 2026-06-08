import zhAgents from './locales/zh-CN/agents.json';
import zhChannelAuth from './locales/zh-CN/channel-auth.json';
import zhChannels from './locales/zh-CN/channels.json';
import zhChat from './locales/zh-CN/chat.json';
import zhCore from './locales/zh-CN/core.json';
import zhCron from './locales/zh-CN/cron.json';
import zhDesktopUpdate from './locales/zh-CN/desktop-update.json';
import zhDocBrowser from './locales/zh-CN/doc-browser.json';
import zhMarketplace from './locales/zh-CN/marketplace.json';
import zhPathPicker from './locales/zh-CN/path-picker.json';
import zhPwa from './locales/zh-CN/pwa.json';
import zhRemote from './locales/zh-CN/remote.json';
import zhRuntimeControl from './locales/zh-CN/runtime-control.json';
import zhSearch from './locales/zh-CN/search.json';
import enAgents from './locales/en-US/agents.json';
import enChannelAuth from './locales/en-US/channel-auth.json';
import enChannels from './locales/en-US/channels.json';
import enChat from './locales/en-US/chat.json';
import enCore from './locales/en-US/core.json';
import enCron from './locales/en-US/cron.json';
import enDesktopUpdate from './locales/en-US/desktop-update.json';
import enDocBrowser from './locales/en-US/doc-browser.json';
import enMarketplace from './locales/en-US/marketplace.json';
import enPathPicker from './locales/en-US/path-picker.json';
import enPwa from './locales/en-US/pwa.json';
import enRemote from './locales/en-US/remote.json';
import enRuntimeControl from './locales/en-US/runtime-control.json';
import enSearch from './locales/en-US/search.json';
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

type MessageCatalog = Record<string, string>;
type LegacyLabelCatalog = Record<string, Record<I18nLanguage, string>>;

const zhCatalog: MessageCatalog = {
  ...zhCore,
  ...zhDesktopUpdate,
  ...zhSearch,
  ...zhChannels,
  ...zhCron,
  ...zhRemote,
  ...zhRuntimeControl,
  ...zhChat,
  ...zhAgents,
  ...zhMarketplace,
  ...zhDocBrowser,
  ...zhPathPicker,
  ...zhPwa,
  ...zhChannelAuth
};

const enCatalog: MessageCatalog = {
  ...enCore,
  ...enDesktopUpdate,
  ...enSearch,
  ...enChannels,
  ...enCron,
  ...enRemote,
  ...enRuntimeControl,
  ...enChat,
  ...enAgents,
  ...enMarketplace,
  ...enDocBrowser,
  ...enPathPicker,
  ...enPwa,
  ...enChannelAuth
};

const CATALOGS: Record<I18nLanguage, MessageCatalog> = {
  zh: zhCatalog,
  en: enCatalog
};

export const LABELS: LegacyLabelCatalog = Object.fromEntries(
  Object.keys(enCatalog).map((key) => [
    key,
    {
      zh: zhCatalog[key] ?? enCatalog[key] ?? key,
      en: enCatalog[key] ?? key
    }
  ])
);

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
  return CATALOGS[lang]?.[key] ?? enCatalog[key] ?? key;
}
