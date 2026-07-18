import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { cn } from '@/lib/utils';
import { themePreferences, useThemeStore } from '@/features/preferences/stores/theme.store';

type Props = {
  className?: string;
};

export function ThemeSwitcher({ className }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const t = createTranslator(locale);

  return (
    <div
      role="radiogroup"
      aria-label={t('common.themeLabel')}
      className={cn('grid grid-cols-3 gap-0.5 rounded-lg bg-[var(--color-control)] p-0.5', className)}
    >
      {themePreferences.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={preference === item}
          className={cn(
            'min-w-0 rounded-md px-2 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-200',
            preference === item
              ? 'bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)]'
          )}
          onClick={() => setPreference(item)}
        >
          {t(`common.themes.${item}`)}
        </button>
      ))}
    </div>
  );
}
