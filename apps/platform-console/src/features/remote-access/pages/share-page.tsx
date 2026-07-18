import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { openRemoteShare } from '@/api/client';
import { LocaleSwitcher } from '@/shared/components/locale-switcher';
import { Button } from '@/shared/components/button';
import { Card, CardTitle } from '@/shared/components/card';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  grantToken: string;
};

export function SharePage({ grantToken }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const openShareQuery = useQuery({
    queryKey: ['remote-share-open', grantToken],
    queryFn: async () => await openRemoteShare(grantToken),
    retry: false
  });

  useEffect(() => {
    if (openShareQuery.data?.openUrl) {
      window.location.replace(openShareQuery.data.openUrl);
    }
  }, [openShareQuery.data]);

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] px-4 py-10 text-[var(--color-foreground)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher />
        </div>
      </div>
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full space-y-4 rounded-[32px] p-6 shadow-[0_24px_80px_rgba(31,31,29,0.08)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700 dark:text-brand-300">{t('share.tag')}</p>
            <CardTitle>{t('share.title')}</CardTitle>
            <p className="text-sm text-[var(--color-foreground-muted)]">
              {t('share.description')}
            </p>
          </div>

          {openShareQuery.isLoading ? (
            <p className="text-sm text-[var(--color-foreground-muted)]">{t('share.loading')}</p>
          ) : null}

          {openShareQuery.error ? (
            <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/40">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{t('share.unavailableTitle')}</p>
              <p className="text-sm text-rose-600 dark:text-rose-300">
                {openShareQuery.error instanceof Error ? openShareQuery.error.message : t('share.unavailableFallback')}
              </p>
              <Button onClick={() => void openShareQuery.refetch()} disabled={openShareQuery.isFetching}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}

          {openShareQuery.data ? (
            <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
              <p className="text-sm font-medium text-[var(--color-foreground)]">{t('share.sessionCreated')}</p>
              <p className="break-all text-xs text-[var(--color-foreground-subtle)]">{openShareQuery.data.openUrl}</p>
              <Button onClick={() => window.location.replace(openShareQuery.data?.openUrl ?? '/')}>
                {t('common.openNow')}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
