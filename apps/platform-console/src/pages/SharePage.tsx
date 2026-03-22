import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { openRemoteShare } from '@/api/client';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-end">
          <LocaleSwitcher />
        </div>
      </div>
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
        <Card className="w-full space-y-4 rounded-[32px] border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{t('share.tag')}</p>
            <CardTitle>{t('share.title')}</CardTitle>
            <p className="text-sm text-slate-500">
              {t('share.description')}
            </p>
          </div>

          {openShareQuery.isLoading ? (
            <p className="text-sm text-slate-600">{t('share.loading')}</p>
          ) : null}

          {openShareQuery.error ? (
            <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">{t('share.unavailableTitle')}</p>
              <p className="text-sm text-rose-600">
                {openShareQuery.error instanceof Error ? openShareQuery.error.message : t('share.unavailableFallback')}
              </p>
              <Button onClick={() => void openShareQuery.refetch()} disabled={openShareQuery.isFetching}>
                {t('common.retry')}
              </Button>
            </div>
          ) : null}

          {openShareQuery.data ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">{t('share.sessionCreated')}</p>
              <p className="break-all text-xs text-slate-500">{openShareQuery.data.openUrl}</p>
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
