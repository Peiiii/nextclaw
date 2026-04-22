import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getLanguage,
  initializeI18n,
  setLanguage as applyLanguage,
  subscribeLanguageChange,
  t,
  type I18nLanguage,
} from '@/shared/lib/i18n';

type I18nContextValue = {
  language: I18nLanguage;
  setLanguage: (lang: I18nLanguage) => void;
  toggleLanguage: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<I18nLanguage>(() => initializeI18n());

  useEffect(() => {
    const unsubscribe = subscribeLanguageChange((next) => {
      setLanguageState(next);
    });
    return unsubscribe;
  }, []);

  const setLanguage = useCallback((lang: I18nLanguage) => {
    applyLanguage(lang);
    setLanguageState(getLanguage());
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  }, [language, setLanguage]);

  // Ensure descendants re-render when language changes; most text calls global t().
  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage }),
    [language, setLanguage, toggleLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue & { t: typeof t } {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return {
    ...ctx,
    t,
  };
}
