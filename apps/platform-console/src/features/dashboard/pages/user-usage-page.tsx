import { useMemo } from 'react';
import type { UserView } from '@/api/types';
import {
  ConsoleMetricCard,
  ConsoleMetricGrid,
  ConsolePage,
  ConsoleSection
} from '@/shared/components/console-page';
import { Card, CardTitle } from '@/shared/components/card';
import { RemoteQuotaCard } from '@/features/dashboard/components/remote-quota-card';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
  user: UserView;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

export function UserUsagePage({ token, user }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <ConsolePage>
      <ConsoleMetricGrid className="xl:grid-cols-2">
        <ConsoleMetricCard
          label={t('app.metrics.freeQuotaRemaining')}
          value={formatUsd(user.freeRemainingUsd)}
          hint={`${formatUsd(user.freeUsedUsd)} / ${formatUsd(user.freeLimitUsd)}`}
        />
        <ConsoleMetricCard
          label={t('app.metrics.paidBalance')}
          value={formatUsd(user.paidBalanceUsd)}
          hint={t(`app.roles.${user.role}`)}
        />
      </ConsoleMetricGrid>
      <ConsoleSection>
        <RemoteQuotaCard locale={locale} t={t} token={token} />
      </ConsoleSection>
      <ConsoleSection>
        <BillingComingSoonCard t={t} />
      </ConsoleSection>
    </ConsolePage>
  );
}

function BillingComingSoonCard({ t }: { t: Translate }): JSX.Element {
  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{t('billing.title')}</CardTitle>
          <p className="text-sm leading-6 text-[var(--color-foreground-muted)]">{t('billing.description')}</p>
        </div>
        <span className="rounded-full bg-[#f3eee2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#926f29] dark:bg-amber-950/40 dark:text-amber-300">
          {t('billing.badge')}
        </span>
      </div>
    </Card>
  );
}
