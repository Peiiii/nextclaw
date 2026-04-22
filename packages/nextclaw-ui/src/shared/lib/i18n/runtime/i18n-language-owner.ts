export type I18nLanguage = 'zh' | 'en';

const I18N_STORAGE_KEY = 'nextclaw.ui.language';
const LANGUAGE_TO_LOCALE: Record<I18nLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN'
};

export const LANGUAGE_OPTIONS: Array<{ value: I18nLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }
];

class I18nLanguageOwner {
  private activeLanguage: I18nLanguage = 'en';
  private initialized = false;
  private readonly listeners = new Set<(lang: I18nLanguage) => void>();

  private isLanguage = (value: unknown): value is I18nLanguage => {
    return value === 'en' || value === 'zh';
  };

  private detectBrowserLanguage = (): I18nLanguage => {
    if (typeof navigator === 'undefined') {
      return 'en';
    }
    const preferred = navigator.language?.toLowerCase() ?? 'en';
    return preferred.startsWith('zh') ? 'zh' : 'en';
  };

  private getDesktopBridge = () => {
    return typeof window === 'undefined' ? null : window.nextclawDesktop ?? null;
  };

  resolveInitialLanguage = (): I18nLanguage => {
    if (typeof window === 'undefined') {
      return 'en';
    }

    const desktopBridge = this.getDesktopBridge();
    if (desktopBridge) {
      return this.isLanguage(desktopBridge.localePreference)
        ? desktopBridge.localePreference
        : this.detectBrowserLanguage();
    }

    try {
      const saved = window.localStorage.getItem(I18N_STORAGE_KEY);
      if (this.isLanguage(saved)) {
        return saved;
      }
    } catch {
      // ignore storage failures
    }

    return this.detectBrowserLanguage();
  };

  initialize = (): I18nLanguage => {
    if (!this.initialized) {
      this.activeLanguage = this.resolveInitialLanguage();
      this.initialized = true;
    }
    return this.activeLanguage;
  };

  getLanguage = (): I18nLanguage => (this.initialized ? this.activeLanguage : this.initialize());

  setLanguage = (lang: I18nLanguage): void => {
    this.initialize();
    if (this.activeLanguage === lang) {
      return;
    }

    this.activeLanguage = lang;

    const desktopBridge = this.getDesktopBridge();
    if (desktopBridge) {
      void desktopBridge.setLocalePreference?.(lang);
    } else if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(I18N_STORAGE_KEY, lang);
      } catch {
        // ignore storage failures
      }
    }

    this.listeners.forEach((listener) => listener(lang));
  };

  subscribeLanguageChange = (listener: (lang: I18nLanguage) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getLocale = (lang: I18nLanguage = this.getLanguage()): string => LANGUAGE_TO_LOCALE[lang];
}

const owner = new I18nLanguageOwner();

export const resolveInitialLanguage = owner.resolveInitialLanguage;
export const initializeI18n = owner.initialize;
export const getLanguage = owner.getLanguage;
export const setLanguage = owner.setLanguage;
export const subscribeLanguageChange = owner.subscribeLanguageChange;
export const getLocale = owner.getLocale;
