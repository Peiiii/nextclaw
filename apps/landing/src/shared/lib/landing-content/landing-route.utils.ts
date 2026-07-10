import type { Locale, PageRoute } from './landing-content.types';

export const LOCALE_STORAGE_KEY = 'nextclaw.landing.locale';

export const ROUTES: Record<Locale, Record<PageRoute, string>> = {
  en: {
    home: '/en/',
    download: '/en/download/',
    install: '/en/install/',
    useCases: '/en/use-cases/',
    integrations: '/en/integrations/',
    releases: '/en/releases/'
  },
  zh: {
    home: '/zh/',
    download: '/zh/download/',
    install: '/zh/install/',
    useCases: '/zh/use-cases/',
    integrations: '/zh/integrations/',
    releases: '/zh/releases/'
  }
};

export const ROUTE_SEGMENTS: Record<string, PageRoute> = {
  download: 'download',
  install: 'install',
  'use-cases': 'useCases',
  integrations: 'integrations',
  releases: 'releases'
};

export const LOCALE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' }
];

export const LINKS: Record<'github' | 'npm' | 'discord' | 'wechatGroupImage', string> & { docs: Record<Locale, string> } = {
  github: 'https://github.com/Peiiii/nextclaw',
  npm: 'https://www.npmjs.com/package/nextclaw',
  discord: 'https://discord.gg/j4Skbgye',
  wechatGroupImage: '/contact/nextclaw-contact-wechat-group-2026-06-03.png',
  docs: {
    en: 'https://docs.nextclaw.io/en/',
    zh: 'https://docs.nextclaw.io/zh/'
  }
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'zh';
}

export function isPageRoute(value: string | null | undefined): value is PageRoute {
  return value === 'home'
    || value === 'download'
    || value === 'install'
    || value === 'useCases'
    || value === 'integrations'
    || value === 'releases';
}

export function readSavedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore persistence failures
  }
}

export function resolvePageLocale(): Locale {
  if (isLocale(window.__NEXTCLAW_LOCALE__)) {
    return window.__NEXTCLAW_LOCALE__;
  }

  const pathLocale = window.location.pathname.split('/')[1];
  if (isLocale(pathLocale)) {
    return pathLocale;
  }

  const saved = readSavedLocale();
  if (saved) {
    return saved;
  }

  const browserLang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh\b/i.test(browserLang) ? 'zh' : 'en';
}

export function resolvePageRoute(): PageRoute {
  if (isPageRoute(window.__NEXTCLAW_ROUTE__)) {
    return window.__NEXTCLAW_ROUTE__;
  }

  const [, maybeLocale, maybeRoute] = window.location.pathname.split('/');
  const route = ROUTE_SEGMENTS[maybeRoute ?? ''];
  if (isLocale(maybeLocale) && route) {
    return route;
  }

  return 'home';
}
