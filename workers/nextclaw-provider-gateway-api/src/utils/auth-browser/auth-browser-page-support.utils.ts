import type { BrowserAuthLocale } from "@/services/auth-browser/auth-browser-page-renderer.service.js";
import type { BrowserAuthCopyTree } from "@/configs/auth-browser/auth-browser-page-copy.config.js";

export type CopyParams = Record<string, string | number>;

export const browserAuthLocaleCookie = "nextclaw_platform_auth_locale";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function interpolateCopy(template: string, params?: CopyParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function readCopyValue(tree: BrowserAuthCopyTree, key: string): string | null {
  const segments = key.split(".");
  let current: string | BrowserAuthCopyTree = tree;
  for (const segment of segments) {
    if (typeof current === "string" || !(segment in current)) {
      return null;
    }
    current = current[segment] as string | BrowserAuthCopyTree;
  }
  return typeof current === "string" ? current : null;
}

function normalizeBrowserAuthLocale(input: string | null | undefined): BrowserAuthLocale | null {
  const normalized = (input ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  return null;
}

function readCookieValue(cookieHeader: string | null | undefined, cookieName: string): string | null {
  const cookie = cookieHeader ?? "";
  if (!cookie) {
    return null;
  }
  const pairs = cookie.split(";");
  for (const pair of pairs) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (rawName !== cookieName) {
      continue;
    }
    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function readAcceptLanguageLocale(headerValue: string | null | undefined): BrowserAuthLocale | null {
  const raw = (headerValue ?? "").trim();
  if (!raw) {
    return null;
  }
  const languageCandidates = raw.split(",").map((item) => item.trim());
  for (const languageCandidate of languageCandidates) {
    const locale = normalizeBrowserAuthLocale(languageCandidate.split(";")[0] ?? "");
    if (locale) {
      return locale;
    }
  }
  return null;
}

export function resolveBrowserAuthLocale(params: {
  explicitLocale?: string | null;
  cookieHeader?: string | null;
  acceptLanguageHeader?: string | null;
}): BrowserAuthLocale {
  const explicitLocale = normalizeBrowserAuthLocale(params.explicitLocale);
  if (explicitLocale) {
    return explicitLocale;
  }

  const cookieLocale = normalizeBrowserAuthLocale(
    readCookieValue(params.cookieHeader, browserAuthLocaleCookie),
  );
  if (cookieLocale) {
    return cookieLocale;
  }

  const browserLocale = readAcceptLanguageLocale(params.acceptLanguageHeader);
  if (browserLocale) {
    return browserLocale;
  }

  return "en-US";
}

export function formatLocaleDateTime(locale: BrowserAuthLocale, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function renderRichCopy(template: string, params: CopyParams): string {
  return interpolateCopy(template, Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, escapeHtml(String(value))]),
  ));
}

export function parseLockedUntilValue(message: string | undefined): string | null {
  if (!message) {
    return null;
  }
  const matched = message.match(/until\s+(.+?)\.?$/i);
  const candidate = matched?.[1]?.trim() ?? "";
  if (!candidate || Number.isNaN(Date.parse(candidate))) {
    return null;
  }
  return candidate;
}

export function resolveBrowserAuthErrorKey(errorCode: string | undefined): string | null {
  switch (errorCode) {
    case "MISSING_SESSION":
      return "notices.error.missingSession";
    case "SESSION_NOT_FOUND":
      return "notices.error.sessionNotFound";
    case "SESSION_EXPIRED":
      return "notices.error.sessionExpired";
    case "INVALID_CREDENTIALS":
      return "notices.error.invalidCredentials";
    case "INVALID_EMAIL":
      return "notices.error.invalidEmail";
    case "WEAK_PASSWORD":
      return "notices.error.weakPassword";
    case "EMAIL_EXISTS":
      return "notices.error.emailExists";
    case "EMAIL_NOT_FOUND":
      return "notices.error.emailNotFound";
    case "CODE_ALREADY_SENT":
      return "notices.error.codeAlreadySent";
    case "INVALID_CODE":
      return "notices.error.invalidCode";
    case "CODE_NOT_FOUND":
      return "notices.error.codeNotFound";
    case "TOO_MANY_ATTEMPTS":
      return "notices.error.tooManyAttempts";
    case "ACCOUNT_LOCKED":
      return "notices.error.accountLocked";
    case "REGISTER_FAILED":
      return "notices.error.registerFailed";
    case "PASSWORD_UPDATE_FAILED":
      return "notices.error.passwordUpdateFailed";
    case "EMAIL_PROVIDER_NOT_CONFIGURED":
      return "notices.error.emailProviderNotConfigured";
    case "EMAIL_DELIVERY_FAILED":
      return "notices.error.emailDeliveryFailed";
    default:
      return null;
  }
}

export function resolveBrowserAuthSuccessKey(successCode: string | undefined): string | null {
  switch (successCode) {
    case "VERIFICATION_CODE_SENT":
      return "notices.success.verificationCodeSent";
    case "DEVICE_LINKED":
      return "notices.success.deviceLinked";
    case "ACCOUNT_CREATED_AND_AUTHORIZED":
      return "notices.success.accountCreatedAndAuthorized";
    case "PASSWORD_RESET_AND_AUTHORIZED":
      return "notices.success.passwordResetAndAuthorized";
    case "ALREADY_AUTHORIZED":
      return "notices.success.alreadyAuthorized";
    default:
      return null;
  }
}
