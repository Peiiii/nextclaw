import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface
} from '@/components/admin/admin-page';
import type { AdminDistributionAdoptionOverview } from '@/features/admin-overview/types/distribution-adoption.types';

type Props = {
  overview: AdminDistributionAdoptionOverview | undefined;
  isLoading: boolean;
  errorMessage: string | null;
};

export function DistributionAdoptionOverviewPanel(props: Props): JSX.Element {
  if (props.isLoading) {
    return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">正在加载发行数据...</AdminSurface>;
  }
  if (props.errorMessage) {
    return <AdminSurface className="p-5 text-sm text-rose-600">{props.errorMessage}</AdminSurface>;
  }
  if (!props.overview) {
    return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">暂无发行数据。</AdminSurface>;
  }

  const githubStatus = props.overview.sources.find((source) => source.source === 'github_release');
  const npmStatus = props.overview.sources.find((source) => source.source === 'npm_registry');
  return (
    <div className="space-y-4">
      <AdminMetricGrid>
        <AdminMetricCard label="GitHub 资产累计下载" value={formatCount(props.overview.github.totalDownloads)} hint="所有已采集 Release 文件累计" />
        <AdminMetricCard label="GitHub 今日新增" value={formatNullableCount(props.overview.github.todayDownloads)} hint="相对最近日快照" />
        <AdminMetricCard label="GitHub 昨日新增" value={formatNullableCount(props.overview.github.yesterdayDownloads)} hint="相邻日快照差值" />
        <AdminMetricCard label="npm 最新统计日" value={formatNullableCount(props.overview.npm.latestDownloads)} hint={props.overview.npm.latestDate ?? 'npm 尚未返回完整统计日'} />
      </AdminMetricGrid>

      <AdminSurface className="space-y-2 p-5 text-sm text-[#656561]">
        <p>最近成功同步：{formatTimestamp(props.overview.fetchedAt)}</p>
        <p>
          GitHub 每日增量从 {props.overview.github.firstDailySnapshotDate ?? '首个定时快照'} 起可信；
          npm 已回填最近 30 日。GitHub：{sourceSummary(githubStatus)}；npm：{sourceSummary(npmStatus)}。
        </p>
      </AdminSurface>

      <NpmDailyTrend trend={props.overview.npm.trend} />

      <AdminSurface className="overflow-x-auto p-0">
        <table className="min-w-[820px] w-full text-left text-sm">
          <thead className="border-b border-[#e8e3d8] bg-[#faf8f3] text-xs text-[#656561]">
            <tr>
              <th className="px-4 py-3 font-medium">发布物</th>
              <th className="px-4 py-3 font-medium">类别</th>
              <th className="px-4 py-3 font-medium">平台</th>
              <th className="px-4 py-3 text-right font-medium">累计</th>
              <th className="px-4 py-3 text-right font-medium">今日</th>
              <th className="px-4 py-3 text-right font-medium">昨日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee9df] text-[#1f1f1d]">
            {props.overview.assets.map((asset) => (
              <tr key={`${asset.source}:${asset.assetKey}`}>
                <td className="max-w-[360px] px-4 py-3">
                  <p className="truncate font-medium" title={asset.assetName}>{asset.assetName}</p>
                  <p className="mt-1 text-xs text-[#8f8a7d]">{asset.releaseTag ?? '未归属 Release'}</p>
                </td>
                <td className="px-4 py-3 text-[#656561]">{formatArtifactKind(asset.artifactKind)}</td>
                <td className="px-4 py-3 text-[#656561]">{[asset.platform, asset.architecture].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCount(asset.downloadCount)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNullableCount(asset.todayDownloads)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNullableCount(asset.yesterdayDownloads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminSurface>
    </div>
  );
}

function NpmDailyTrend(props: { trend: AdminDistributionAdoptionOverview['npm']['trend'] }): JSX.Element {
  if (props.trend.length === 0) return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">npm 尚未返回日下载数据。</AdminSurface>;
  const maximum = Math.max(1, ...props.trend.map((item) => item.downloads));
  return (
    <AdminSurface className="space-y-4 p-5">
      <div>
        <p className="text-sm font-semibold text-[#1f1f1d]">npm 最近 30 日下载</p>
        <p className="mt-1 text-sm text-[#656561]">展示 npm 已完成统计日；悬停柱状图可查看日期与下载次数。</p>
      </div>
      <div className="overflow-x-auto pb-1">
        <ol className="flex h-44 min-w-[720px] items-end gap-1" aria-label="npm 最近 30 日下载趋势">
          {props.trend.map((item) => (
            <li key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${item.date}：${item.downloads} 次下载`}>
              <div className="flex h-32 w-full items-end rounded-t bg-[#f5f3ee] px-px" aria-hidden="true">
                <div className="w-full rounded-t bg-[#4f7ee8]" style={{ height: `${(item.downloads / maximum) * 100}%`, minHeight: item.downloads > 0 ? 3 : 0 }} />
              </div>
              <span className="text-[10px] text-[#8f8a7d]">{item.date.slice(8)}</span>
              <span className="sr-only">{item.date}：{item.downloads} 次下载</span>
            </li>
          ))}
        </ol>
      </div>
    </AdminSurface>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatNullableCount(value: number | null): string {
  return value === null ? '—' : formatCount(value);
}

function formatTimestamp(value: string | null): string {
  if (!value) return '尚未同步';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Shanghai'
  }).format(new Date(value));
}

function sourceSummary(source: AdminDistributionAdoptionOverview['sources'][number] | undefined): string {
  if (!source) return '尚未同步';
  return source.lastError ? `最近失败：${source.lastError}` : '正常';
}

function formatArtifactKind(kind: AdminDistributionAdoptionOverview['assets'][number]['artifactKind']): string {
  return {
    npm_runtime_bundle: 'NPM runtime bundle',
    desktop_installer: 'Desktop 安装包',
    desktop_portable: 'Desktop 便携包',
    desktop_runtime_bundle: 'Desktop runtime bundle',
    update_metadata: '更新元数据',
    other: '其他发布物'
  }[kind];
}
