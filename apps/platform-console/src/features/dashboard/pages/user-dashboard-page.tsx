import { useMemo } from 'react';
import type { UserView } from '@/api/types';
import { ConsolePage, ConsoleSection } from '@/components/console/console-page';
import { WorkbenchSummaryStrip } from '@/components/console/workbench-summary-strip';
import { Card, CardTitle } from '@/components/ui/card';
import { RemoteInstancesCard } from '@/features/dashboard/components/remote-instances-card';
import { RemoteQuotaCard } from '@/features/dashboard/components/remote-quota-card';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  token: string;
  user: UserView;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

function BillingComingSoonCard({ t }: { t: Translate }): JSX.Element {
  return (
    <Card className="rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>{t('billing.title')}</CardTitle>
          <p className="text-sm leading-6 text-[#656561]">{t('billing.description')}</p>
        </div>
        <span className="rounded-full bg-[#f3eee2] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#926f29]">
          {t('billing.badge')}
        </span>
      </div>
    </Card>
  );
}

export function UserDashboardPage({ token, user }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <ConsolePage>
      <WorkbenchSummaryStrip t={t} user={user} />
      <ConsoleSection>
        <RemoteQuotaCard locale={locale} t={t} token={token} />
      </ConsoleSection>
      <ConsoleSection>
        <RemoteInstancesCard locale={locale} t={t} token={token} />
      </ConsoleSection>
      <ConsoleSection>
        <BillingComingSoonCard t={t} />
      </ConsoleSection>
    </ConsolePage>
  );
}
