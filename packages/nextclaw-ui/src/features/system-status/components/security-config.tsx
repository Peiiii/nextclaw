import { RuntimeSecurityCard } from '@/components/config/runtime-security-card';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { t } from '@/lib/i18n';

export function SecurityConfig() {
  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('authSecurityTitle')} description={t('authSecurityDescription')} />
      <RuntimeSecurityCard />
    </PageLayout>
  );
}
