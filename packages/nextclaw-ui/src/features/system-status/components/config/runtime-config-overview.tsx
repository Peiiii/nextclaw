import { PageHeader } from '@/app/components/layout/page-layout';
import { RuntimeControlCard } from '@/features/system-status/components/runtime-control-card';
import { RuntimePresenceCard } from '@/features/system-status/components/runtime-presence-card';
import { t } from '@/shared/lib/i18n';
import { PwaInstallCard } from '@/features/pwa';

export function RuntimeConfigOverview() {
  return (
    <>
      <PageHeader title={t('runtimePageTitle')} description={t('runtimePageDescription')} />
      <RuntimeControlCard />
      <RuntimePresenceCard />
      <PwaInstallCard />
    </>
  );
}
