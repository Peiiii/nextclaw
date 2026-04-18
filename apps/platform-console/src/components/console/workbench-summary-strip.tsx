import type { UserView } from '@/api/types';
import {
  ConsoleMetricCard,
  ConsoleMetricGrid
} from '@/components/console/console-page';
import { formatUsd } from '@/lib/utils';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  t: Translate;
  user: UserView;
};

export function WorkbenchSummaryStrip({ t, user }: Props): JSX.Element {
  const publishScope = user.username ? `@${user.username}/*` : t('account.publishScopeMissing');

  return (
    <ConsoleMetricGrid>
      <ConsoleMetricCard
        label={t('app.metrics.publishReadiness')}
        value={user.username ? t('account.readiness.ready') : t('account.readiness.missing')}
        hint={publishScope}
      />
      <ConsoleMetricCard
        label={t('account.fields.publishScope')}
        value={user.username ? publishScope : t('account.values.notSet')}
        hint={user.email}
      />
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
  );
}
