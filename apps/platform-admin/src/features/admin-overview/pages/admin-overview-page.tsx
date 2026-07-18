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
  fetchAdminOverview
} from '@/api/client';
import { AdminRemoteQuotaApiService } from '@/features/admin-overview/services/remote-quota-api.service';
import type { AdminRemoteQuotaSummary } from '@/features/admin-overview/types/remote-quota.types';
import { formatUsd } from '@/lib/utils';
import { GatewayBusinessLoopSection } from '@/pages/admin-gateway-business-loop';

type Props = {
  token: string;
};

export function AdminOverviewPage({ token }: Props): JSX.Element {
  const remoteQuotaApi = new AdminRemoteQuotaApiService(token);
  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const remoteQuotaQuery = useQuery({
    queryKey: ['admin-remote-quota'],
    queryFn: remoteQuotaApi.fetchSummary
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
        description="按 Cloudflare 真实请求事件展示平台日预算、已发生用量、连接预留与近期趋势。"
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
              configuredLimit={summary.day.workerRequests.configuredLimit}
              enforcedLimit={summary.day.workerRequests.limit}
              actualUsed={summary.day.workerRequests.actualUsed}
              reserved={summary.day.workerRequests.reserved}
              remaining={summary.day.workerRequests.remaining}
              unitLabel="次"
            />
            <QuotaMetricCard
              title="平台 Durable Object 日预算"
              configuredLimit={summary.day.durableObjectRequests.configuredLimit}
              enforcedLimit={summary.day.durableObjectRequests.limit}
              actualUsed={summary.day.durableObjectRequests.actualUsed}
              reserved={summary.day.durableObjectRequests.reserved}
              remaining={summary.day.durableObjectRequests.remaining}
              unitLabel="请求单位"
            />
          </div>

          <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-5">
            <p className="text-sm font-semibold text-[#1f1f1d]">默认 remote 配置</p>
            <dl className="mt-4 space-y-3 text-sm">
              <QuotaMetaRow label="Cloudflare 套餐档案" value={`${summary.plan.id}（${summary.plan.resetsAt} 重置）`} />
              <QuotaMetaRow label="默认用户 Worker 日额度" value={`${formatQuotaNumber(summary.defaultUserWorkerBudget)} 次`} />
              <QuotaMetaRow label="默认用户 DO 日额度" value={`${formatQuotaNumber(summary.defaultUserDoBudget)} 请求单位`} />
              <QuotaMetaRow label="容量合同" value={`可同时覆盖 ${summary.calibration.supportedHeavyUsers} 个满额重度用户`} />
              <QuotaMetaRow label="共享平台安全预留" value={`${summary.calibration.safetyReservePercent}%`} />
              <QuotaMetaRow label="单实例连接上限" value={`${formatQuotaNumber(summary.instanceConnectionsPerInstance)} 个`} />
              <QuotaMetaRow label="最近 30 分钟" value={formatRecentUsage(summary.recent.last30Minutes)} />
              <QuotaMetaRow label="最近 1 小时" value={formatRecentUsage(summary.recent.lastHour)} />
              <QuotaMetaRow label="异常突发保护" value="仅观察，不限制正常使用" />
              <QuotaMetaRow label="成本模型" value={`Cloudflare 精确事件 v${summary.costModel.version}`} />
              <QuotaMetaRow label="今日重置时间" value={new Date(summary.day.resetsAt).toLocaleString()} />
            </dl>
            {summary.costModel.partialDay ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                今日为 v2 日中启用后的部分日数据；下一个 UTC 自然日开始提供完整统计。
              </p>
            ) : null}
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
  actualUsed: number;
  reserved: number;
  remaining: number;
  unitLabel: string;
}): JSX.Element {
  const used = props.actualUsed + props.reserved;
  const utilization = props.enforcedLimit > 0 ? used / props.enforcedLimit : 1;
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-5">
      <p className="text-sm font-semibold text-[#1f1f1d]">{props.title}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1f1f1d]">
        {formatQuotaNumber(used)}
        <span className="ml-2 text-sm font-medium text-[#656561]">/ {formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</span>
      </p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7e3da]"
        role="progressbar"
        aria-label={props.title}
        aria-valuemin={0}
        aria-valuemax={props.enforcedLimit}
        aria-valuenow={Math.min(used, props.enforcedLimit)}
      >
        <div
          className={utilization >= 1 ? 'h-full bg-rose-500' : utilization >= 0.8 ? 'h-full bg-amber-500' : 'h-full bg-emerald-500'}
          style={{ width: `${Math.min(100, Math.max(0, utilization * 100))}%` }}
        />
      </div>
      <div className="mt-4 space-y-1 text-sm text-[#656561]">
        <p>配置总额度：{formatQuotaNumber(props.configuredLimit)} {props.unitLabel}</p>
        <p>实际放量额度：{formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</p>
        <p>实际已用：{formatQuotaNumber(props.actualUsed)} {props.unitLabel}</p>
        <p>连接预留：{formatQuotaNumber(props.reserved)} {props.unitLabel}</p>
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

function formatRecentUsage(usage: { workerRequests: number; durableObjectRequests: number }): string {
  return `Worker ${formatQuotaNumber(usage.workerRequests)} 次 · DO ${formatQuotaNumber(usage.durableObjectRequests)} 请求单位`;
}
