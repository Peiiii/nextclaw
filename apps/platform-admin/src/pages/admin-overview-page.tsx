import { useQuery } from '@tanstack/react-query';
import {
  fetchAdminMarketplaceSkills,
  fetchAdminOverview,
  fetchAdminRemoteQuotaSummary
} from '@/api/client';
import type { AdminRemoteQuotaSummary } from '@/api/types';
import { Card, CardTitle } from '@/components/ui/card';
import { cn, formatUsd } from '@/lib/utils';
import {
  ADMIN_CONSOLE_ROUTES,
  getAdminConsoleHref,
  type AdminConsoleRouteKey
} from '@/pages/admin-console-navigation';
import { GatewayBusinessLoopSection } from '@/pages/admin-gateway-business-loop';

type Props = {
  token: string;
};

type OverviewLinkCardProps = {
  routeKey: AdminConsoleRouteKey;
  summary: string;
  accentClassName: string;
};

export function AdminOverviewPage({ token }: Props): JSX.Element {
  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const remoteQuotaQuery = useQuery({
    queryKey: ['admin-remote-quota'],
    queryFn: async () => await fetchAdminRemoteQuotaSummary(token)
  });
  const marketplaceCountsQuery = useQuery({
    queryKey: ['admin-marketplace-skills', 'pending', '', 1, 'overview-counts'],
    queryFn: async () => await fetchAdminMarketplaceSkills(token, {
      publishStatus: 'pending',
      page: 1,
      pageSize: 1
    })
  });

  const overview = overviewQuery.data;
  const pendingMarketplaceCount = marketplaceCountsQuery.data?.counts.pending ?? 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-900 bg-slate-950 p-0 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-sky-200/80">Platform Governance</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">平台治理总览</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                这里是 NextClaw 平台后台的统一控制面。你可以从同一个入口看到平台健康度、额度状态、Marketplace
                审核与核心经营面板，再进入具体治理页面执行动作。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetricCard label="全局免费池上限" value={formatUsd(overview?.globalFreeLimitUsd ?? 0)} />
              <OverviewMetricCard label="全局免费池已消耗" value={formatUsd(overview?.globalFreeUsedUsd ?? 0)} />
              <OverviewMetricCard label="用户数" value={String(overview?.userCount ?? 0)} />
              <OverviewMetricCard label="待审核充值" value={String(overview?.pendingRechargeIntents ?? 0)} />
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <OverviewLinkCard
              routeKey="marketplace"
              summary={`${pendingMarketplaceCount} 个待审核 skill 正等待处理`}
              accentClassName="from-amber-400/20 via-amber-300/10 to-transparent"
            />
            <OverviewLinkCard
              routeKey="users"
              summary={`${overview?.userCount ?? 0} 个平台用户已纳入额度治理`}
              accentClassName="from-sky-400/20 via-sky-300/10 to-transparent"
            />
            <OverviewLinkCard
              routeKey="recharge"
              summary={`${overview?.pendingRechargeIntents ?? 0} 个充值申请待处理`}
              accentClassName="from-emerald-400/20 via-emerald-300/10 to-transparent"
            />
          </div>
        </div>
      </Card>

      <RemoteQuotaOverviewCard
        summary={remoteQuotaQuery.data}
        isLoading={remoteQuotaQuery.isLoading}
        errorMessage={remoteQuotaQuery.error instanceof Error ? remoteQuotaQuery.error.message : null}
      />

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Business Loop</p>
          <h3 className="text-xl font-semibold text-slate-950">营收与上游治理</h3>
          <p className="text-sm text-slate-500">
            第一版先继续保留在总览页，后续若模块继续增长，再独立拆成 `Remote 管控` 或 `平台设置` 页面。
          </p>
        </div>
        <GatewayBusinessLoopSection token={token} />
      </section>
    </div>
  );
}

function OverviewMetricCard(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{props.label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{props.value}</p>
    </div>
  );
}

function OverviewLinkCard({ routeKey, summary, accentClassName }: OverviewLinkCardProps): JSX.Element {
  const route = ADMIN_CONSOLE_ROUTES.find((item) => item.key === routeKey);
  if (!route) {
    return <></>;
  }
  return (
    <a
      href={getAdminConsoleHref(route.key)}
      className={cn(
        'rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:border-white/20',
        'bg-gradient-to-br',
        accentClassName
      )}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{route.eyebrow}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-white">{route.label}</p>
        <span className="text-sm text-sky-200">进入</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{summary}</p>
    </a>
  );
}

function RemoteQuotaOverviewCard(props: {
  summary: AdminRemoteQuotaSummary | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}): JSX.Element {
  const summary = props.summary;
  return (
    <Card className="space-y-4 rounded-[28px]">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Remote Quota</p>
        <CardTitle>Remote 额度总览</CardTitle>
        <p className="text-sm text-slate-500">
          平台预算会先扣除 {summary?.reservePercent ?? 0}% 安全预留后，再参与实际放量。这里聚合展示当前日预算、剩余额度与默认用户配额。
        </p>
      </div>

      {props.isLoading ? <p className="text-sm text-slate-500">加载额度中...</p> : null}
      {props.errorMessage ? <p className="text-sm text-rose-600">{props.errorMessage}</p> : null}

      {summary ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            <QuotaMetricCard
              title="平台 Worker 日预算"
              configuredLimit={summary.workerRequests.configuredLimit}
              enforcedLimit={summary.workerRequests.enforcedLimit}
              used={summary.workerRequests.used}
              remaining={summary.workerRequests.remaining}
              unitLabel="次"
            />
            <QuotaMetricCard
              title="平台 Durable Object 日预算"
              configuredLimit={summary.durableObjectRequests.configuredLimit}
              enforcedLimit={summary.durableObjectRequests.enforcedLimit}
              used={summary.durableObjectRequests.used}
              remaining={summary.durableObjectRequests.remaining}
              unitLabel="请求单位"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">默认 remote 配置</p>
            <dl className="mt-4 space-y-3 text-sm">
              <QuotaMetaRow label="默认用户 Worker 日额度" value={`${formatQuotaNumber(summary.defaultUserWorkerBudget)} 次`} />
              <QuotaMetaRow label="默认用户 DO 日额度" value={`${formatQuotaNumber(summary.defaultUserDoBudget)} 请求单位`} />
              <QuotaMetaRow label="每分钟 session 上限" value={`${formatQuotaNumber(summary.sessionRequestsPerMinute)} 次`} />
              <QuotaMetaRow label="单实例连接上限" value={`${formatQuotaNumber(summary.instanceConnectionsPerInstance)} 个`} />
              <QuotaMetaRow label="今日重置时间" value={new Date(summary.resetsAt).toLocaleString()} />
            </dl>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function QuotaMetricCard(props: {
  title: string;
  configuredLimit: number;
  enforcedLimit: number;
  used: number;
  remaining: number;
  unitLabel: string;
}): JSX.Element {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">
        {formatQuotaNumber(props.used)}
        <span className="ml-2 text-sm font-medium text-slate-500">/ {formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</span>
      </p>
      <div className="mt-4 space-y-1 text-sm text-slate-500">
        <p>配置总额度：{formatQuotaNumber(props.configuredLimit)} {props.unitLabel}</p>
        <p>实际放量额度：{formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</p>
        <p>剩余：{formatQuotaNumber(props.remaining)} {props.unitLabel}</p>
      </div>
    </div>
  );
}

function QuotaMetaRow(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{props.label}</dt>
      <dd className="text-right font-medium text-slate-900">{props.value}</dd>
    </div>
  );
}

function formatQuotaNumber(value: number): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat().format(value);
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}
