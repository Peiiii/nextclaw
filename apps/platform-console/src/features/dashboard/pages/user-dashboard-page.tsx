import { useMemo } from 'react';
import { ConsolePage, ConsoleSection } from '@/shared/components/console-page';
import { RemoteInstancesCard } from '@/features/dashboard/components/remote-instances-card';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';

type Props = {
  token: string;
};

export function UserDashboardPage({ token }: Props): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  return (
    <ConsolePage>
      <ConsoleSection>
        <RemoteInstancesCard locale={locale} t={t} token={token} />
      </ConsoleSection>
    </ConsolePage>
  );
}
