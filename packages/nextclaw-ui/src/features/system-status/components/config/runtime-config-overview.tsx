import { PageHeader } from '@/components/layout/page-layout';
import { RuntimeControlCard } from '@/features/system-status/components/runtime-control-card';
import { RuntimePresenceCard } from '@/features/system-status/components/runtime-presence-card';
import { t } from '@/lib/i18n';
import { PwaInstallCard } from '@/pwa/components/pwa-install-entry';

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
