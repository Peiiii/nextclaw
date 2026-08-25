import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminSection,
  AdminSurface
} from '@/components/admin/admin-page';
import { Button } from '@/components/ui/button';
import { DistributionAdoptionOverviewPanel } from '@/features/admin-overview/components/distribution-adoption-overview-panel';
import {
  fetchAdminMarketplaceSkills,
  fetchAdminOverview
} from '@/api/client';
import { AdminRemoteQuotaApiService } from '@/features/admin-overview/services/remote-quota-api.service';
import { AdminProductActivityApiService } from '@/features/admin-overview/services/product-activity-api.service';
import { AdminDistributionAdoptionApiService } from '@/features/admin-overview/services/distribution-adoption-api.service';
import type {
  AdminProductActivityOverview,
  ProductActivityAudience
} from '@/features/admin-overview/types/product-activity.types';
import type { AdminDistributionAssetListQuery } from '@/features/admin-overview/types/distribution-adoption.types';
import type { AdminRemoteQuotaSummary } from '@/features/admin-overview/types/remote-quota.types';
import { formatUsd } from '@/lib/utils';
import { GatewayBusinessLoopSection } from '@/pages/admin-gateway-business-loop';

type Props = {
  token: string;
};

export function AdminOverviewPage({ token }: Props): JSX.Element {
  const [productActivityAudience, setProductActivityAudience] = useState<ProductActivityAudience>('external');
  const [distributionAssetListQuery, setDistributionAssetListQuery] = useState<AdminDistributionAssetListQuery>({
    page: 1,
    pageSize: 10,
    query: '',
    artifactKind: null,
    platform: null,
    sortBy: 'default',
    sortDirection: 'desc'
  });
  const queryClient = useQueryClient();
  const remoteQuotaApi = new AdminRemoteQuotaApiService(token);
  const productActivityApi = new AdminProductActivityApiService(token);
  const distributionAdoptionApi = new AdminDistributionAdoptionApiService(token);
  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const remoteQuotaQuery = useQuery({
    queryKey: ['admin-remote-quota'],
    queryFn: remoteQuotaApi.fetchSummary
  });
  const productActivityQuery = useQuery({
    queryKey: ['admin-product-activity', productActivityAudience, 'production', 'stable', 30],
    queryFn: async () => await productActivityApi.fetchOverview(productActivityAudience)
  });
  const distributionAdoptionQuery = useQuery({
    queryKey: ['admin-distribution-adoption', distributionAssetListQuery],
    queryFn: async () => await distributionAdoptionApi.fetchOverview(distributionAssetListQuery),
    placeholderData: keepPreviousData
  });
  const refreshDistributionMutation = useMutation({
    mutationFn: distributionAdoptionApi.refresh,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-distribution-adoption'] });
    }
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
        title="产品活跃"
        description="统计默认开启的匿名活跃安装回执。默认只看外部用户、生产环境和稳定版。"
        actions={(
          <label className="flex items-center gap-2 text-sm text-[#656561]" htmlFor="product-activity-audience">
            <span>统计人群</span>
            <select
              id="product-activity-audience"
              aria-label="统计人群"
              className="rounded-lg border border-[#d8d3c8] bg-white px-3 py-2 text-sm font-medium text-[#1f1f1d] outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/30"
              value={productActivityAudience}
              onChange={(event) => setProductActivityAudience(event.target.value as ProductActivityAudience)}
            >
              <option value="external">外部用户</option>
              <option value="internal">团队 / 自用</option>
              <option value="qa">QA 测试</option>
            </select>
          </label>
        )}
      >
        <ProductActivityOverviewPanel
          overview={productActivityQuery.data}
          isLoading={productActivityQuery.isLoading}
          errorMessage={productActivityQuery.error instanceof Error ? productActivityQuery.error.message : null}
        />
      </AdminSection>

      <AdminSection
        title="发行与采用"
        description="GitHub Release 资产与 npm 包的公开聚合下载数据。下载不等于独立用户、安装成功或产品活跃。"
        actions={(
          <Button
            type="button"
            variant="secondary"
            className="h-9 shrink-0 px-3"
            disabled={refreshDistributionMutation.isPending}
            onClick={() => refreshDistributionMutation.mutate()}
          >
            {refreshDistributionMutation.isPending ? '刷新中…' : '刷新实时数据'}
          </Button>
        )}
      >
        <DistributionAdoptionOverviewPanel
          overview={distributionAdoptionQuery.data}
          assetListQuery={distributionAssetListQuery}
          isLoading={distributionAdoptionQuery.isLoading}
          isRefreshing={distributionAdoptionQuery.isFetching}
          errorMessage={distributionAdoptionQuery.error instanceof Error
            ? distributionAdoptionQuery.error.message
            : refreshDistributionMutation.error instanceof Error
              ? refreshDistributionMutation.error.message
              : null}
          onAssetListQueryChange={setDistributionAssetListQuery}
        />
      </AdminSection>

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

function ProductActivityOverviewPanel(props: {
  overview: AdminProductActivityOverview | undefined;
  isLoading: boolean;
  errorMessage: string | null;
}): JSX.Element {
  if (props.isLoading) {
    return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">正在加载产品活跃数据...</AdminSurface>;
  }
  if (props.errorMessage) {
    return <AdminSurface className="p-5 text-sm text-rose-600">{props.errorMessage}</AdminSurface>;
  }
  if (!props.overview) {
    return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">暂无产品活跃数据。</AdminSurface>;
  }

  const { metrics, trend } = props.overview;
  return (
    <div className="space-y-4">
      <AdminMetricGrid>
        <AdminMetricCard label="核心 DAU" value={formatCount(metrics.dau)} hint="今天提交过请求" />
        <AdminMetricCard label="核心 WAU" value={formatCount(metrics.wau)} hint="本自然周活跃安装" />
        <AdminMetricCard label="核心 MAU" value={formatCount(metrics.mau)} hint="本自然月活跃安装" />
        <AdminMetricCard label="日成功活跃" value={formatCount(metrics.successfulDau)} hint="今天至少成功一次" />
        <AdminMetricCard label="周成功活跃" value={formatCount(metrics.successfulWau)} hint="本自然周至少成功一次" />
        <AdminMetricCard label="月成功活跃" value={formatCount(metrics.successfulMau)} hint="本自然月至少成功一次" />
        <AdminMetricCard label="统计日期" value={props.overview.asOfDate} hint="Asia/Shanghai" />
      </AdminMetricGrid>

      <AdminSurface className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1f1f1d]">最近 30 日趋势</p>
            <p className="mt-1 text-sm text-[#656561]">蓝色为提交过请求，绿色为至少成功一次。</p>
          </div>
          <p className="text-xs leading-5 text-[#8f8a7d]">回执不含账号或长期设备标识；活跃安装不等于精确人数。</p>
        </div>
        <ProductActivityTrend trend={trend} />
      </AdminSurface>
    </div>
  );
}

function ProductActivityTrend(props: {
  trend: AdminProductActivityOverview['trend'];
}): JSX.Element {
  const maximum = Math.max(1, ...props.trend.flatMap((item) => [item.active, item.successful]));
  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex h-44 min-w-[720px] items-end gap-1" aria-label="最近 30 日产品活跃趋势">
        {props.trend.map((item) => (
          <li
            key={item.date}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
            title={`${item.date}：活跃 ${item.active}，成功 ${item.successful}`}
          >
            <div className="flex h-32 w-full items-end justify-center gap-px rounded-t bg-[#f5f3ee] px-px" aria-hidden="true">
              <div
                className="w-1/2 rounded-t bg-[#4f7ee8]"
                style={{ height: `${(item.active / maximum) * 100}%`, minHeight: item.active > 0 ? 3 : 0 }}
              />
              <div
                className="w-1/2 rounded-t bg-[#39a36d]"
                style={{ height: `${(item.successful / maximum) * 100}%`, minHeight: item.successful > 0 ? 3 : 0 }}
              />
            </div>
            <span className="text-[10px] text-[#8f8a7d]">{item.date.slice(8)}</span>
            <span className="sr-only">{item.date}：活跃 {item.active}，成功 {item.successful}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
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
