import { browserAuthCopy, supportedBrowserAuthLocales } from "@/configs/auth-browser-page-copy.config.js";
import { browserAuthPageStyles } from "@/configs/auth-browser-page-styles.config.js";
import {
  browserAuthLocaleCookie,
  escapeAttribute,
  escapeHtml,
  formatLocaleDateTime,
  interpolateCopy,
  parseLockedUntilValue,
  readCopyValue,
  renderRichCopy,
  resolveBrowserAuthErrorKey,
  resolveBrowserAuthSuccessKey,
  type CopyParams,
} from "@/utils/auth-browser-page-support.utils.js";

export type BrowserAuthMode = "login" | "register" | "reset_password";
export type BrowserAuthLocale = "zh-CN" | "en-US";
type BrowserAuthPageState = "pending" | "authorized" | "expired" | "missing";

type RenderBrowserAuthPageParams = {
  sessionId: string;
  pageState: BrowserAuthPageState;
  expiresAt: string | null;
  mode: BrowserAuthMode;
  locale: BrowserAuthLocale;
  email?: string;
  maskedEmail?: string;
  codeStepActive?: boolean;
  errorCode?: string;
  errorMessage?: string;
  successCode?: string;
  successMessage?: string;
};

export function resolveBrowserAuthMode(raw: string | null | undefined): BrowserAuthMode {
  if (raw === "register") {
    return "register";
  }
  if (raw === "reset_password" || raw === "reset-password") {
    return "reset_password";
  }
  return "login";
}

export { resolveBrowserAuthLocale } from "@/utils/auth-browser-page-support.utils.js";

class BrowserAuthPageRenderer {
  constructor(private readonly params: RenderBrowserAuthPageParams) {}

  render = (): Response => {
    const html = this.renderDocument();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": `${browserAuthLocaleCookie}=${encodeURIComponent(this.params.locale)}; Path=/platform/auth; Max-Age=31536000; SameSite=Lax`,
        vary: "accept-language, cookie",
      },
    });
  };

  private readonly t = (key: string, params?: CopyParams): string => {
    const copyTree = browserAuthCopy[this.params.locale];
    const localized = readCopyValue(copyTree, key);
    const fallback = this.params.locale === "en-US" ? null : readCopyValue(browserAuthCopy["en-US"], key);
    return interpolateCopy(localized ?? fallback ?? key, params);
  };

  private readonly renderDocument = (): string => {
    const headingTitle = this.t(`heading.${this.params.pageState}.title`);
    const headingSubtitle = this.t(`heading.${this.params.pageState}.subtitle`);
    const content = this.params.pageState === "pending"
      ? this.renderPendingPanel()
      : this.renderResolvedPanel();

    return `<!doctype html>
<html lang="${escapeAttribute(this.params.locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(`${headingTitle} | ${this.t("meta.htmlTitle")}`)}</title>
    <style>${browserAuthPageStyles}</style>
  </head>
  <body>
    <main class="shell">
      <section class="hero-panel">
        <div class="hero-content">
          <div class="hero-copy">
            <p class="eyebrow">${escapeHtml(this.t("meta.platformTag"))}</p>
            <h1>${escapeHtml(this.t("hero.title"))}</h1>
            <p>${escapeHtml(this.t("hero.description"))}</p>
          </div>
          <div class="highlight-list">
            ${this.renderHighlightCard("account")}
            ${this.renderHighlightCard("workflow")}
            ${this.renderHighlightCard("control")}
          </div>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <div class="card-topbar">
            <p class="eyebrow">${escapeHtml(this.t("meta.accountTag"))}</p>
            ${this.renderLocaleSwitcher()}
          </div>
          ${this.params.pageState === "pending" ? this.renderModeTabs() : ""}
          <div class="section-header">
            <p class="eyebrow">${escapeHtml(this.t(`modes.${this.params.mode}.label`))}</p>
            <h2>${escapeHtml(headingTitle)}</h2>
            <p>${escapeHtml(this.params.pageState === "pending" ? this.t(`modes.${this.params.mode}.subtitle`) : headingSubtitle)}</p>
          </div>
          ${content}
        </div>
      </section>
    </main>
  </body>
</html>`;
  };

  private readonly renderHighlightCard = (key: "account" | "workflow" | "control"): string => {
    return `
      <article class="highlight-card">
        <h2>${escapeHtml(this.t(`hero.highlights.${key}.title`))}</h2>
        <p>${escapeHtml(this.t(`hero.highlights.${key}.description`))}</p>
      </article>
    `;
  };

  private readonly renderLocaleSwitcher = (): string => {
    const localeLinks = supportedBrowserAuthLocales.map((locale) => {
      const href = this.renderPageHref({ locale });
      const activeClass = locale === this.params.locale ? "active" : "";
      return `<a class="${activeClass}" href="${escapeAttribute(href)}">${escapeHtml(this.t(`meta.languageNames.${locale}`))}</a>`;
    }).join("");

    return `
      <div class="locale-switcher">
        <span>${escapeHtml(this.t("meta.languageLabel"))}</span>
        ${localeLinks}
      </div>
    `;
  };

  private readonly renderModeTabs = (): string => {
    const modes: BrowserAuthMode[] = ["login", "register", "reset_password"];
    const tabs = modes.map((mode) => {
      const href = this.renderPageHref({ mode, locale: this.params.locale });
      const activeClass = mode === this.params.mode ? "active" : "";
      return `<a class="${activeClass}" href="${escapeAttribute(href)}">${escapeHtml(this.t(`modes.${mode}.label`))}</a>`;
    }).join("");

    return `<div class="mode-switch">${tabs}</div>`;
  };

  private readonly renderPendingPanel = (): string => {
    return `
      ${this.renderNotice("error")}
      ${this.renderNotice("success")}
      ${this.renderPendingContent()}
      <p class="meta">${escapeHtml(this.t("meta.expiresAt", { expiresAt: this.renderExpiresAtText() }))}</p>
    `;
  };

  private readonly renderPendingContent = (): string => {
    if (this.params.mode === "login") {
      return this.renderLoginContent();
    }
    if (this.params.mode === "register") {
      return this.renderRegisterContent();
    }
    return this.renderResetPasswordContent();
  };

  private readonly renderLoginContent = (): string => {
    return `
      <div class="section">
        <p class="section-label">${escapeHtml(this.t("modes.login.sectionLabel"))}</p>
        <p class="section-copy">${escapeHtml(this.t("modes.login.sectionCopy"))}</p>
        <form method="post" action="/platform/auth/browser/login" class="auth-form">
          ${this.renderHiddenFields()}
          ${this.renderEmailField()}
          ${this.renderPasswordField("fields.password", "placeholders.password")}
          <button type="submit">${escapeHtml(this.t("actions.authorize"))}</button>
        </form>
      </div>
    `;
  };

  private readonly renderRegisterContent = (): string => {
    if (!this.params.codeStepActive) {
      return `
        <div class="section">
          <p class="section-label">${escapeHtml(this.t("modes.register.sectionLabel"))}</p>
          <p class="section-copy">${escapeHtml(this.t("modes.register.sectionCopy"))}</p>
          <form method="post" action="/platform/auth/browser/register/send-code" class="auth-form">
            ${this.renderHiddenFields()}
            ${this.renderEmailField()}
            <button type="submit">${escapeHtml(this.t("actions.sendCode"))}</button>
          </form>
        </div>
      `;
    }

    return `
      <div class="section">
        <p class="section-label">${escapeHtml(this.t("modes.register.verifyLabel"))}</p>
        <p class="section-copy">${renderRichCopy(this.t("modes.register.verifyCopy"), {
          email: this.params.maskedEmail || this.params.email || "",
        })}</p>
        <form method="post" action="/platform/auth/browser/register/complete" class="auth-form">
          ${this.renderHiddenFields(true)}
          ${this.renderCodeField()}
          ${this.renderPasswordField("fields.setPassword", "placeholders.passwordMin")}
          <button type="submit">${escapeHtml(this.t("actions.createAccountAndAuthorize"))}</button>
        </form>
        <div class="secondary-actions">
          <form method="post" action="/platform/auth/browser/register/send-code">
            ${this.renderHiddenFields(true)}
            <button type="submit" class="ghost-button">${escapeHtml(this.t("actions.resendCode"))}</button>
          </form>
          <a class="ghost-link" href="${escapeAttribute(this.renderPageHref({ mode: "register", locale: this.params.locale }))}">
            ${escapeHtml(this.t("actions.changeEmail"))}
          </a>
        </div>
      </div>
    `;
  };

  private readonly renderResetPasswordContent = (): string => {
    if (!this.params.codeStepActive) {
      return `
        <div class="section">
          <p class="section-label">${escapeHtml(this.t("modes.reset_password.sectionLabel"))}</p>
          <p class="section-copy">${escapeHtml(this.t("modes.reset_password.sectionCopy"))}</p>
          <form method="post" action="/platform/auth/browser/reset-password/send-code" class="auth-form">
            ${this.renderHiddenFields()}
            ${this.renderEmailField()}
            <button type="submit">${escapeHtml(this.t("actions.sendCode"))}</button>
          </form>
        </div>
      `;
    }

    return `
      <div class="section">
        <p class="section-label">${escapeHtml(this.t("modes.reset_password.verifyLabel"))}</p>
        <p class="section-copy">${renderRichCopy(this.t("modes.reset_password.verifyCopy"), {
          email: this.params.maskedEmail || this.params.email || "",
        })}</p>
        <form method="post" action="/platform/auth/browser/reset-password/complete" class="auth-form">
          ${this.renderHiddenFields(true)}
          ${this.renderCodeField()}
          ${this.renderPasswordField("fields.newPassword", "placeholders.passwordMin")}
          <button type="submit">${escapeHtml(this.t("actions.resetPasswordAndAuthorize"))}</button>
        </form>
        <div class="secondary-actions">
          <form method="post" action="/platform/auth/browser/reset-password/send-code">
            ${this.renderHiddenFields(true)}
            <button type="submit" class="ghost-button">${escapeHtml(this.t("actions.resendCode"))}</button>
          </form>
          <a class="ghost-link" href="${escapeAttribute(this.renderPageHref({ mode: "reset_password", locale: this.params.locale }))}">
            ${escapeHtml(this.t("actions.changeEmail"))}
          </a>
        </div>
      </div>
    `;
  };

  private readonly renderResolvedPanel = (): string => {
    return `
      ${this.renderNotice("error")}
      ${this.renderNotice("success")}
      <div class="state-card">
        <p>${escapeHtml(this.t(`heading.${this.params.pageState}.subtitle`))}</p>
        <p class="meta">${escapeHtml(this.t("meta.sessionPreview", { sessionId: this.renderSessionPreview() }))}</p>
      </div>
    `;
  };

  private readonly renderEmailField = (): string => {
    const emailValue = escapeAttribute(this.params.email ?? "");
    return `
      <label>
        <span>${escapeHtml(this.t("fields.email"))}</span>
        <input type="email" name="email" value="${emailValue}" placeholder="${escapeAttribute(this.t("placeholders.email"))}" required />
      </label>
    `;
  };

  private readonly renderPasswordField = (labelKey: string, placeholderKey: string): string => {
    return `
      <label>
        <span>${escapeHtml(this.t(labelKey))}</span>
        <input type="password" name="password" placeholder="${escapeAttribute(this.t(placeholderKey))}" required />
      </label>
    `;
  };

  private readonly renderCodeField = (): string => {
    return `
      <label>
        <span>${escapeHtml(this.t("fields.code"))}</span>
        <input type="text" inputmode="numeric" name="code" placeholder="${escapeAttribute(this.t("placeholders.code"))}" required />
      </label>
    `;
  };

  private readonly renderHiddenFields = (includeEmail = false): string => {
    const hiddenFields = [
      `<input type="hidden" name="sessionId" value="${escapeAttribute(this.params.sessionId)}" />`,
      `<input type="hidden" name="locale" value="${escapeAttribute(this.params.locale)}" />`,
    ];
    if (includeEmail) {
      hiddenFields.push(`<input type="hidden" name="email" value="${escapeAttribute(this.params.email ?? "")}" />`);
    }
    return hiddenFields.join("");
  };

  private readonly renderNotice = (kind: "error" | "success"): string => {
    const message = kind === "error"
      ? this.resolveErrorNotice()
      : this.resolveSuccessNotice();
    if (!message) {
      return "";
    }
    return `<div class="notice ${kind}">${escapeHtml(message)}</div>`;
  };

  private readonly resolveErrorNotice = (): string | null => {
    if (!this.params.errorCode && !this.params.errorMessage) {
      return null;
    }

    if (this.params.errorCode === "ACCOUNT_LOCKED") {
      const lockedUntil = parseLockedUntilValue(this.params.errorMessage);
      if (lockedUntil) {
        return this.t("notices.accountLockedUntil", {
          time: formatLocaleDateTime(this.params.locale, lockedUntil),
        });
      }
    }

    const mappedKey = resolveBrowserAuthErrorKey(this.params.errorCode);
    if (mappedKey) {
      return this.t(mappedKey);
    }
    return this.params.errorMessage ?? this.t("notices.error.unknown");
  };

  private readonly resolveSuccessNotice = (): string | null => {
    if (!this.params.successCode && !this.params.successMessage) {
      return null;
    }
    const mappedKey = resolveBrowserAuthSuccessKey(this.params.successCode);
    if (mappedKey) {
      return this.t(mappedKey);
    }
    return this.params.successMessage ?? null;
  };

  private readonly renderPageHref = (params: {
    mode?: BrowserAuthMode;
    locale?: BrowserAuthLocale;
  }): string => {
    const { locale, mode } = params;
    const query = new URLSearchParams();
    if (this.params.sessionId) {
      query.set("sessionId", this.params.sessionId);
    }
    if ((mode ?? this.params.mode) !== "login") {
      query.set("mode", mode ?? this.params.mode);
    }
    if (locale ?? this.params.locale) {
      query.set("locale", locale ?? this.params.locale);
    }
    const queryText = query.toString();
    return queryText ? `/platform/auth/browser?${queryText}` : "/platform/auth/browser";
  };

  private readonly renderExpiresAtText = (): string => {
    if (!this.params.expiresAt) {
      return "-";
    }
    return formatLocaleDateTime(this.params.locale, this.params.expiresAt);
  };

  private readonly renderSessionPreview = (): string => {
    return this.params.sessionId ? this.params.sessionId.slice(0, 10) : "-";
  };
}

export function renderBrowserAuthPage(params: RenderBrowserAuthPageParams): Response {
  return new BrowserAuthPageRenderer(params).render();
}
