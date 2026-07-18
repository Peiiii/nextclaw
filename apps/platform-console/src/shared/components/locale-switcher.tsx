import { Button } from '@/shared/components/button';
import { createTranslator, supportedLocales } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  className?: string;
  variant?: 'default' | 'sidebar';
};

export function LocaleSwitcher({ className, variant = 'default' }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const t = createTranslator(locale);

  return (
    <div className={className}>
      <div className={variant === 'sidebar'
        ? 'grid grid-cols-2 gap-0.5 rounded-lg bg-[var(--color-control)] p-0.5'
        : 'flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-1'}>
        {variant === 'default' ? (
          <span className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-foreground-subtle)]">
            {t('common.languageLabel')}
          </span>
        ) : null}
        {supportedLocales.map((item) => (
          <Button
            key={item}
            type="button"
            variant={locale === item ? 'primary' : 'ghost'}
            className={variant === 'sidebar' ? 'rounded-md px-2 py-1 text-[11px]' : 'rounded-lg px-3 py-1.5 text-xs'}
            aria-pressed={locale === item}
            onClick={() => setLocale(item)}
          >
            {t(`common.${variant === 'sidebar' ? 'languagesShort' : 'languages'}.${item}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
