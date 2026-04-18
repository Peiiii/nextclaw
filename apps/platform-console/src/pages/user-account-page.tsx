import { ConsolePage, ConsoleSection } from '@/components/console/console-page';
import { AccountSummaryCard } from '@/components/account/account-summary-card';
import type { UserView } from '@/api/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  token: string;
  user: UserView;
  t: Translate;
};

export function UserAccountPage({ token, user, t }: Props): JSX.Element {
  return (
    <ConsolePage>
      <ConsoleSection
        title={t('account.title')}
        description={t('account.highlightDescription')}
      >
        <AccountSummaryCard token={token} user={user} t={t} highlight />
      </ConsoleSection>
    </ConsolePage>
  );
}
