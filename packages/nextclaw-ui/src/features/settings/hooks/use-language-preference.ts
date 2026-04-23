import { useCallback } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import {
  LANGUAGE_OPTIONS,
  type I18nLanguage,
} from "@/shared/lib/i18n";

export function useLanguagePreference() {
  const { language, setLanguage } = useI18n();
  const currentLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ??
    language;
  const selectLanguage = useCallback(
    (nextLanguage: I18nLanguage) => {
      if (language === nextLanguage) {
        return;
      }
      setLanguage(nextLanguage);
      window.location.reload();
    },
    [language, setLanguage],
  );

  return {
    currentLanguage: language,
    currentLanguageLabel,
    languageOptions: LANGUAGE_OPTIONS,
    selectLanguage,
  };
}
