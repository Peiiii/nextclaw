import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { t } from '@/lib/i18n';
import { RuntimeSecurityCard } from '@/features/system-status/components/runtime-security-card';

export function SecurityConfig() {
  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('authSecurityTitle')} description={t('authSecurityDescription')} />
      <RuntimeSecurityCard />
    </PageLayout>
  );
}
