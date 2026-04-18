import { Button } from '@/components/ui/button';
import { createTranslator, supportedLocales } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  className?: string;
};

export function LocaleSwitcher({ className }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const t = createTranslator(locale);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-1">
        <span className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8f8a7d]">
          {t('common.languageLabel')}
        </span>
        {supportedLocales.map((item) => (
          <Button
            key={item}
            type="button"
            variant={locale === item ? 'primary' : 'ghost'}
            className="rounded-xl px-3 py-1.5 text-xs"
            aria-pressed={locale === item}
            onClick={() => setLocale(item)}
          >
            {t(`common.languages.${item}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
