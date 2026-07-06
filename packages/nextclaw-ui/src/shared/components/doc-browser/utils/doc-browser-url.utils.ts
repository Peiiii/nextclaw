import { getLanguage, type I18nLanguage } from '@/shared/lib/i18n';
import type { DocBrowserTabKind } from '@/shared/components/doc-browser/types/doc-browser.types';

const DOCS_PRIMARY_DOMAIN = 'docs.nextclaw.io';
const DOCS_MAINLAND_DOMAIN = 'docs.nextclaw.net';
const DOCS_PAGES_DEV = 'nextclaw-docs.pages.dev';
const DOCS_HOSTS = new Set([
  DOCS_PRIMARY_DOMAIN,
  `www.${DOCS_PRIMARY_DOMAIN}`,
  DOCS_MAINLAND_DOMAIN,
  `www.${DOCS_MAINLAND_DOMAIN}`,
  DOCS_PAGES_DEV,
  `www.${DOCS_PAGES_DEV}`,
]);

export const DOCS_DEFAULT_BASE_URL = `https://${DOCS_PRIMARY_DOMAIN}`;
export const DOCS_MAINLAND_BASE_URL = `https://${DOCS_MAINLAND_DOMAIN}`;
export const DOC_BROWSER_HOME_TAB_KIND = 'home';
export const DOC_BROWSER_HOME_URL = 'nextclaw://new-tab';
const DOCS_DEFAULT_GUIDE_PATH = '/guide/getting-started';

function toDocsLocale(language: I18nLanguage): 'en' | 'zh' {
  return language === 'zh' ? 'zh' : 'en';
}

function ensureLocalizedDocsPath(pathname: string, locale: 'en' | 'zh'): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (normalized === '/' || normalized === '') {
    return `/${locale}/`;
  }

  if (/^\/(en|zh)(\/|$)/.test(normalized)) {
    return normalized;
  }

  return `/${locale}${normalized}`;
}

function normalizeDocsBaseUrl(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value.trim());
}

function isLikelyMainlandDocsAudience(): boolean {
  return getLanguage() === 'zh' || getBrowserTimeZone() === 'Asia/Shanghai';
}

export function getDocsBaseUrl(): string {
  const configuredBaseUrl = normalizeDocsBaseUrl(import.meta.env.VITE_NEXTCLAW_DOCS_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (isLikelyMainlandDocsAudience()) {
    return normalizeDocsBaseUrl(import.meta.env.VITE_NEXTCLAW_DOCS_CN_BASE_URL) ?? DOCS_MAINLAND_BASE_URL;
  }

  return DOCS_DEFAULT_BASE_URL;
}

function resolveLocalizedDocsUrl(url: string): string {
  const locale = toDocsLocale(getLanguage());
  const docsBaseUrl = getDocsBaseUrl();

  try {
    const parsed = new URL(url, docsBaseUrl);
    const docsBase = new URL(docsBaseUrl);
    const shouldResolveAsDocs = !isAbsoluteUrl(url)
      || DOCS_HOSTS.has(parsed.hostname)
      || parsed.origin === docsBase.origin;
    if (!shouldResolveAsDocs) {
      return parsed.toString();
    }

    parsed.protocol = docsBase.protocol;
    parsed.host = docsBase.host;
    parsed.pathname = ensureLocalizedDocsPath(parsed.pathname, locale);
    return parsed.toString();
  } catch {
    return new URL(`/${locale}${DOCS_DEFAULT_GUIDE_PATH}`, docsBaseUrl).toString();
  }
}

export function getDefaultDocsUrl(): string {
  return resolveLocalizedDocsUrl(DOCS_DEFAULT_GUIDE_PATH);
}

export function getDocsUrl(pathOrUrl: string): string {
  return resolveLocalizedDocsUrl(pathOrUrl);
}

export function normalizeDocUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/\.html$/, '').replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function inferTabTitle(url: string, kind: DocBrowserTabKind, fallback = 'Docs'): string {
  try {
    const parsed = new URL(url, DOCS_DEFAULT_BASE_URL);
    if (parsed.protocol === 'data:') {
      return kind === 'docs' ? fallback : 'Detail';
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const leaf = segments[segments.length - 1] ?? fallback;
    return decodeURIComponent(leaf).replace(/[-_]/g, ' ').slice(0, 40) || fallback;
  } catch {
    return fallback;
  }
}

export function isDocsUrl(url: string): boolean {
  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : DOCS_DEFAULT_BASE_URL;
    const parsed = new URL(url, fallbackOrigin);
    return DOCS_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function inferTabKind(url: string): DocBrowserTabKind {
  return isDocsUrl(url) ? 'docs' : 'content';
}

export function normalizeUrlByKind(url: string, kind: DocBrowserTabKind): string {
  if (kind === 'docs') {
    return resolveLocalizedDocsUrl(url);
  }
  return url;
}
