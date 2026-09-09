import type { UserView } from '@/api/types';
import { AdminSupportReviewPage } from '@/features/support-review';
import { AdminShell } from '@/app/admin-shell';
import {
  ADMIN_CONSOLE_ROUTES,
  useAdminConsoleRoute,
  type AdminConsoleRouteKey
} from '@/app/admin-console-navigation.config';
import { AdminMarketplaceReviewPage } from '@/app/admin-marketplace-review-page';
import { AdminMarketplaceAppReviewPage } from '@/features/marketplace-app-review';
import { AdminOverviewPage } from '@/features/admin-overview';
import { AdminUserQuotaPage } from '@/features/admin-users';
import { AdminRechargeReviewPage } from '@/app/admin-recharge-review-page';

type Props = {
  token: string;
  user: UserView | null;
  onLogout: () => void;
};

export function AdminDashboardPage({ token, user, onLogout }: Props): JSX.Element {
  const currentRoute = useAdminConsoleRoute();
  const currentUserEmail = user?.email ?? '未识别账号';

  return (
    <AdminShell
      routes={ADMIN_CONSOLE_ROUTES}
      currentRoute={currentRoute}
      currentUserEmail={currentUserEmail}
      onLogout={onLogout}
    >
      {renderRoutePage(token, currentRoute.key)}
    </AdminShell>
  );
}

function renderRoutePage(token: string, routeKey: AdminConsoleRouteKey): JSX.Element {
  switch (routeKey) {
    case 'support':
      return <AdminSupportReviewPage token={token} />;
    case 'marketplace':
      return <AdminMarketplaceReviewPage token={token} />;
    case 'marketplace-apps':
      return <AdminMarketplaceAppReviewPage token={token} />;
    case 'users':
      return <AdminUserQuotaPage token={token} />;
    case 'recharge':
      return <AdminRechargeReviewPage token={token} />;
    case 'overview':
    default:
      return <AdminOverviewPage token={token} />;
  }
}
