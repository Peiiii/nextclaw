import { AdminPage } from '@/components/admin/admin-page';
import { AdminMarketplaceAppReviewSection } from '@/pages/marketplace-app-review/admin-marketplace-app-review-section';

type Props = {
  token: string;
};

export function AdminMarketplaceAppReviewPage({ token }: Props): JSX.Element {
  return (
    <AdminPage>
      <AdminMarketplaceAppReviewSection token={token} showHeader={false} />
    </AdminPage>
  );
}
