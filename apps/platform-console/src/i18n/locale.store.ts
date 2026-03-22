import { create } from 'zustand';
import { resolveLocale, type LocaleCode } from '@/i18n/i18n.service';

const STORAGE_KEY = 'nextclaw.platform.locale';

function readBrowserLocale(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.navigator.languages?.[0] ?? window.navigator.language ?? null;
}

function readInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') {
    return 'en-US';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return resolveLocale(stored);
  }
  return resolveLocale(readBrowserLocale());
}

type LocaleState = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: readInitialLocale(),
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
    set({ locale });
  }
}));
