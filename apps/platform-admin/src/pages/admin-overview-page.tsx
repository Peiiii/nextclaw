import { useQuery } from '@tanstack/react-query';
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminSection,
  AdminSurface
} from '@/components/admin/admin-page';
import {
  fetchAdminMarketplaceSkills,
  fetchAdminOverview,
  fetchAdminRemoteQuotaSummary
} from '@/api/client';
import type { AdminRemoteQuotaSummary } from '@/api/types';
import { formatUsd } from '@/lib/utils';
import { GatewayBusinessLoopSection } from '@/pages/admin-gateway-business-loop';

type Props = {
  token: string;
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
    <AdminPage>
      <AdminMetricGrid>
        <AdminMetricCard label="全局免费池上限" value={formatUsd(overview?.globalFreeLimitUsd ?? 0)} />
        <AdminMetricCard label="全局免费池已消耗" value={formatUsd(overview?.globalFreeUsedUsd ?? 0)} />
        <AdminMetricCard label="用户数" value={String(overview?.userCount ?? 0)} />
        <AdminMetricCard label="待审核充值" value={String(overview?.pendingRechargeIntents ?? 0)} hint={`${pendingMarketplaceCount} 个待审核 skill`} />
      </AdminMetricGrid>

      <AdminSection
        title="Remote 额度总览"
        description="这里展示平台 remote 的当前日预算、剩余额度和默认用户配额。"
      >
        <RemoteQuotaOverviewCard
          summary={remoteQuotaQuery.data}
          isLoading={remoteQuotaQuery.isLoading}
          errorMessage={remoteQuotaQuery.error instanceof Error ? remoteQuotaQuery.error.message : null}
        />
      </AdminSection>

      <AdminSection
        title="营收与上游治理"
        description="延续现有平台经营面板，后续若规模继续增长，再单独拆成新治理页面。"
      >
        <GatewayBusinessLoopSection token={token} />
      </AdminSection>
    </AdminPage>
  );
}

function RemoteQuotaOverviewCard(props: {
  summary: AdminRemoteQuotaSummary | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}): JSX.Element {
  const summary = props.summary;
  return (
    <AdminSurface className="space-y-4 p-5">
      {props.isLoading ? <p className="text-sm text-[#8f8a7d]">加载额度中...</p> : null}
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

          <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-5">
            <p className="text-sm font-semibold text-[#1f1f1d]">默认 remote 配置</p>
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
    </AdminSurface>
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
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-5">
      <p className="text-sm font-semibold text-[#1f1f1d]">{props.title}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1f1f1d]">
        {formatQuotaNumber(props.used)}
        <span className="ml-2 text-sm font-medium text-[#656561]">/ {formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</span>
      </p>
      <div className="mt-4 space-y-1 text-sm text-[#656561]">
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
      <dt className="text-[#656561]">{props.label}</dt>
      <dd className="text-right font-medium text-[#1f1f1d]">{props.value}</dd>
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
