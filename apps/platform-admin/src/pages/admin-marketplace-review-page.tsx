import { AdminPage } from '@/components/admin/admin-page';
import { AdminMarketplaceReviewSection } from '@/pages/admin-marketplace-review-section';

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
