import { AdminPage } from '@/components/admin/admin-page';
import { AdminMarketplaceReviewSection } from '@/features/marketplace-skill-review';

type Props = {
  token: string;
};

export function AdminMarketplaceReviewPage({ token }: Props): JSX.Element {
  return (
    <AdminPage>
      <AdminMarketplaceReviewSection token={token} showHeader={false} />
    </AdminPage>
  );
}
