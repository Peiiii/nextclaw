import { Check, Languages } from "lucide-react";
import { useLanguagePreference } from "@/features/settings/hooks/use-language-preference";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function LanguageSettingsPage() {
  const {
    currentLanguage,
    currentLanguageLabel,
    languageOptions,
    selectLanguage,
  } = useLanguagePreference();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
            <Languages className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900">
              {t("language")}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {currentLanguageLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-card">
        {languageOptions.map((option) => {
          const active = option.value === currentLanguage;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectLanguage(option.value)}
              className={cn(
                "flex w-full items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 text-left text-sm transition-colors last:border-b-0",
                active
                  ? "bg-gray-50 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50/70",
              )}
              aria-current={active ? "true" : undefined}
            >
              <span className="font-medium">{option.label}</span>
              {active ? <Check className="h-4 w-4 text-gray-700" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
