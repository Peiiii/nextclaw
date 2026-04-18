import type { UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ADMIN_CONSOLE_ROUTES,
  getAdminConsoleHref,
  useAdminConsoleRoute,
  type AdminConsoleRouteKey
} from '@/pages/admin-console-navigation';
import { AdminMarketplaceReviewSection } from '@/pages/admin-marketplace-review-section';
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

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-[30px] border border-slate-900 bg-slate-950 px-5 py-6 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-sky-200/80">NextClaw Admin Console</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">平台治理控制台</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            用更稳定的后台壳层统一承接 Marketplace 审核、额度管理与充值审核，让平台治理回到一个清晰可扩展的入口。
          </p>
        </div>

        <Card className="rounded-[30px] p-3">
          <nav className="space-y-2">
            {ADMIN_CONSOLE_ROUTES.map((route) => {
              const isActive = route.key === currentRoute.key;
              return (
                <a
                  key={route.key}
                  href={getAdminConsoleHref(route.key)}
                  className={cn(
                    'block rounded-2xl border px-4 py-3 transition-colors',
                    isActive
                      ? 'border-brand-300 bg-brand-50 text-brand-900'
                      : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{route.eyebrow}</p>
                  <p className="mt-1 text-sm font-semibold">{route.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{route.description}</p>
                </a>
              );
            })}
          </nav>
        </Card>

        <Card className="rounded-[30px] bg-slate-50">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Current Admin</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">{user?.email ?? '未识别账号'}</p>
          <p className="mt-1 text-sm text-slate-500">角色：{user?.role ?? 'unknown'}</p>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            后续新增治理模块时，只需要继续往这个控制台增加一级导航，不再回到单页平铺结构。
          </p>
        </Card>
      </aside>

      <div className="min-w-0 space-y-4">
        <Card className="rounded-[30px] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">{currentRoute.eyebrow}</p>
              <h2 className="text-2xl font-semibold text-slate-950">{currentRoute.label}</h2>
              <p className="text-sm text-slate-500">{currentRoute.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                production
              </span>
              <Button variant="ghost" onClick={onLogout}>退出</Button>
            </div>
          </div>
        </Card>

        {renderRoutePage(token, currentRoute.key)}
      </div>
    </div>
  );
}

function renderRoutePage(token: string, routeKey: AdminConsoleRouteKey): JSX.Element {
  switch (routeKey) {
    case 'marketplace':
      return <AdminMarketplaceReviewSection token={token} />;
    case 'users':
      return <AdminUserQuotaPage token={token} />;
    case 'recharge':
      return <AdminRechargeReviewPage token={token} />;
    case 'overview':
    default:
      return <AdminOverviewPage token={token} />;
  }
}
