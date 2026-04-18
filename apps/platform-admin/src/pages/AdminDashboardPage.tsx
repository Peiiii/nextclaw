import type { UserView } from '@/api/types';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  ADMIN_CONSOLE_ROUTES,
  useAdminConsoleRoute,
  type AdminConsoleRouteKey
} from '@/pages/admin-console-navigation';
import { AdminMarketplaceReviewPage } from '@/pages/admin-marketplace-review-page';
import { AdminOverviewPage } from '@/pages/admin-overview-page';
import { AdminRechargeReviewPage } from '@/pages/admin-recharge-review-page';
import { AdminUserQuotaPage } from '@/pages/admin-user-quota-page';

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
    case 'marketplace':
      return <AdminMarketplaceReviewPage token={token} />;
    case 'users':
      return <AdminUserQuotaPage token={token} />;
    case 'recharge':
      return <AdminRechargeReviewPage token={token} />;
    case 'overview':
    default:
      return <AdminOverviewPage token={token} />;
  }
}
