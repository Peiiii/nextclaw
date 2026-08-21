import { useState, type FormEvent } from 'react';
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminSurface
} from '@/components/admin/admin-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  AdminDistributionAdoptionOverview,
  AdminDistributionAssetListQuery,
  AdminDistributionAssetSortBy
} from '@/features/admin-overview/types/distribution-adoption.types';

type Props = {
  overview: AdminDistributionAdoptionOverview | undefined;
  assetListQuery: AdminDistributionAssetListQuery;
  isLoading: boolean;
  errorMessage: string | null;
  onAssetListQueryChange: (query: AdminDistributionAssetListQuery) => void;
};

export function DistributionAdoptionOverviewPanel(props: Props): JSX.Element {
  const [searchInput, setSearchInput] = useState(props.assetListQuery.query);
  if (props.isLoading) return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">正在加载发行数据...</AdminSurface>;
  if (props.errorMessage) return <AdminSurface className="p-5 text-sm text-rose-600">{props.errorMessage}</AdminSurface>;
  if (!props.overview) return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">暂无发行数据。</AdminSurface>;

  const githubStatus = props.overview.sources.find((source) => source.source === 'github_release');
  const npmStatus = props.overview.sources.find((source) => source.source === 'npm_registry');
  const assetList = props.overview.assets;
  const hasActiveFilters = Boolean(props.assetListQuery.query || props.assetListQuery.artifactKind || props.assetListQuery.platform);

  function updateAssetListQuery(update: Partial<AdminDistributionAssetListQuery>): void {
    props.onAssetListQueryChange({ ...props.assetListQuery, ...update });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    updateAssetListQuery({ page: 1, query: searchInput.trim() });
  }

  function resetFilters(): void {
    setSearchInput('');
    props.onAssetListQueryChange({
      page: 1,
      pageSize: props.assetListQuery.pageSize,
      query: '',
      artifactKind: null,
      platform: null,
      sortBy: props.assetListQuery.sortBy,
      sortDirection: props.assetListQuery.sortDirection
    });
  }

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
        <p>GitHub 每日增量从 {props.overview.github.firstDailySnapshotDate ?? '首个定时快照'} 起可信；npm 已回填最近 30 日。GitHub：{sourceSummary(githubStatus)}；npm：{sourceSummary(npmStatus)}。</p>
      </AdminSurface>

      <NpmDailyTrend trend={props.overview.npm.trend} />

      <AdminSurface className="space-y-3 p-3 md:p-5">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-[#1f1f1d]">GitHub 发布物</p>
            <p className="mt-1 text-sm text-[#656561]">按发布物或 Release 定位；每页只展示当前范围。</p>
          </div>
          <form className="flex min-w-0 gap-2" onSubmit={submitSearch}>
            <Input aria-label="搜索发布物或 Release" className="min-w-0 flex-1" placeholder="搜索发布物或 Release" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <Button type="submit" variant="secondary" className="shrink-0 px-3">搜索</Button>
            {hasActiveFilters ? <Button type="button" variant="ghost" className="shrink-0 px-2 md:px-3" onClick={resetFilters}>重置</Button> : null}
          </form>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#656561]">
              <span className="shrink-0">类别</span>
              <select
                aria-label="发布物类别"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#d9d3c5] bg-white px-2 text-sm text-[#1f1f1d] outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
                value={props.assetListQuery.artifactKind ?? ''}
                onChange={(event) => updateAssetListQuery({
                  page: 1,
                  artifactKind: (event.target.value || null) as AdminDistributionAssetListQuery['artifactKind']
                })}
              >
                <option value="">全部类别</option>
                {assetList.artifactKinds.map((kind) => <option key={kind} value={kind}>{formatArtifactKind(kind)}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#656561]">
              <span className="shrink-0">平台</span>
              <select
                aria-label="发布物平台"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#d9d3c5] bg-white px-2 text-sm text-[#1f1f1d] outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
                value={props.assetListQuery.platform ?? ''}
                onChange={(event) => updateAssetListQuery({ page: 1, platform: event.target.value || null })}
              >
                <option value="">全部平台</option>
                {assetList.platforms.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </label>
          </div>
        </div>

        {assetList.total > 0 ? <DistributionAssetTable
          assets={assetList.items}
          sortBy={props.assetListQuery.sortBy}
          sortDirection={props.assetListQuery.sortDirection}
          onSort={(sortBy) => updateAssetListQuery({
            page: 1,
            sortBy,
            sortDirection: props.assetListQuery.sortBy === sortBy && props.assetListQuery.sortDirection === 'asc' ? 'desc' : 'asc'
          })}
        /> : (
          <div className="rounded-xl border border-dashed border-[#ddd8cd] px-4 py-10 text-center text-sm text-[#8f8a7d]" role="status">当前筛选条件下没有发布物。</div>
        )}

        <DistributionAssetPagination
          page={assetList.page}
          pageSize={assetList.pageSize}
          total={assetList.total}
          totalPages={assetList.totalPages}
          onPageChange={(page) => updateAssetListQuery({ page })}
          onPageSizeChange={(pageSize) => updateAssetListQuery({ page: 1, pageSize })}
        />
      </AdminSurface>
    </div>
  );
}

function DistributionAssetTable(props: {
  assets: AdminDistributionAdoptionOverview['assets']['items'];
  sortBy: AdminDistributionAssetListQuery['sortBy'];
  sortDirection: AdminDistributionAssetListQuery['sortDirection'];
  onSort: (sortBy: AdminDistributionAssetSortBy) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e8e3d8]">
      <table className="min-w-[820px] w-full text-left text-sm">
        <thead className="border-b border-[#e8e3d8] bg-[#faf8f3] text-xs text-[#656561]"><tr>
          <SortableHeader label="发布物" sortBy="asset_name" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
          <SortableHeader label="类别" sortBy="artifact_kind" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
          <SortableHeader label="平台" sortBy="platform" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
          <SortableHeader label="累计" sortBy="download_count" align="right" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
          <SortableHeader label="今日" sortBy="today_downloads" align="right" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
          <SortableHeader label="昨日" sortBy="yesterday_downloads" align="right" currentSortBy={props.sortBy} sortDirection={props.sortDirection} onSort={props.onSort} />
        </tr></thead>
        <tbody className="divide-y divide-[#eee9df] text-[#1f1f1d]">
          {props.assets.map((asset) => <tr key={`${asset.source}:${asset.assetKey}`}>
            <td className="max-w-[360px] px-4 py-3"><p className="truncate font-medium" title={asset.assetName}>{asset.assetName}</p><p className="mt-1 text-xs text-[#8f8a7d]">{asset.releaseTag ?? '未归属 Release'}</p></td>
            <td className="px-4 py-3 text-[#656561]">{formatArtifactKind(asset.artifactKind)}</td>
            <td className="px-4 py-3 text-[#656561]">{[asset.platform, asset.architecture].filter(Boolean).join(' · ') || '—'}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCount(asset.downloadCount)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatNullableCount(asset.todayDownloads)}</td>
            <td className="px-4 py-3 text-right tabular-nums">{formatNullableCount(asset.yesterdayDownloads)}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader(props: {
  label: string;
  sortBy: AdminDistributionAssetSortBy;
  currentSortBy: AdminDistributionAssetListQuery['sortBy'];
  sortDirection: AdminDistributionAssetListQuery['sortDirection'];
  align?: 'left' | 'right';
  onSort: (sortBy: AdminDistributionAssetSortBy) => void;
}): JSX.Element {
  const isActive = props.currentSortBy === props.sortBy;
  const ariaSort = isActive ? (props.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={`px-4 py-3 font-medium ${props.align === 'right' ? 'text-right' : 'text-left'}`} aria-sort={ariaSort}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-0.5 py-0.5 transition-colors hover:text-[#1f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
        onClick={() => props.onSort(props.sortBy)}
      >
        {props.label}
        <span aria-hidden="true" className={isActive ? 'text-[#1f1f1d]' : 'text-[#aaa394]'}>{isActive ? (props.sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
        <span className="sr-only">{isActive ? `，当前${props.sortDirection === 'asc' ? '升序' : '降序'}` : '，点击排序'}</span>
      </button>
    </th>
  );
}

function DistributionAssetPagination(props: {
  page: number;
  pageSize: 10 | 20;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 20) => void;
}): JSX.Element {
  const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const to = props.total === 0 ? 0 : Math.min(props.total, from + props.pageSize - 1);
  return (
    <div className="flex flex-col gap-2 text-sm text-[#656561] sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular-nums">{from}–{to} / 共 {formatCount(props.total)} 个发布物</p>
      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <label className="flex items-center gap-2"><span>每页</span><select aria-label="每页发布物数" className="h-8 rounded-lg border border-[#d9d3c5] bg-white px-2 text-sm text-[#1f1f1d] outline-none focus-visible:ring-2 focus-visible:ring-brand-100" value={props.pageSize} onChange={(event) => props.onPageSizeChange(event.target.value === '20' ? 20 : 10)}><option value="10">10 条</option><option value="20">20 条</option></select></label>
        <span className="text-center tabular-nums sm:min-w-[76px]">{props.totalPages === 0 ? '0 / 0' : `${props.page} / ${props.totalPages}`}</span>
        <Button type="button" variant="ghost" className="h-9 px-3 sm:h-8" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)}>上一页</Button>
        <Button type="button" variant="secondary" className="h-9 px-3 sm:h-8" disabled={props.totalPages === 0 || props.page >= props.totalPages} onClick={() => props.onPageChange(props.page + 1)}>下一页</Button>
      </div>
    </div>
  );
}

function NpmDailyTrend(props: { trend: AdminDistributionAdoptionOverview['npm']['trend'] }): JSX.Element {
  if (props.trend.length === 0) return <AdminSurface className="p-5 text-sm text-[#8f8a7d]">npm 尚未返回日下载数据。</AdminSurface>;
  const maximum = Math.max(1, ...props.trend.map((item) => item.downloads));
  return <AdminSurface className="space-y-4 p-5"><div><p className="text-sm font-semibold text-[#1f1f1d]">npm 最近 30 日下载</p><p className="mt-1 text-sm text-[#656561]">展示 npm 已完成统计日；悬停柱状图可查看日期与下载次数。</p></div><div className="overflow-x-auto pb-1"><ol className="flex h-44 min-w-[720px] items-end gap-1" aria-label="npm 最近 30 日下载趋势">{props.trend.map((item) => <li key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`${item.date}：${item.downloads} 次下载`}><div className="flex h-32 w-full items-end rounded-t bg-[#f5f3ee] px-px" aria-hidden="true"><div className="w-full rounded-t bg-[#4f7ee8]" style={{ height: `${(item.downloads / maximum) * 100}%`, minHeight: item.downloads > 0 ? 3 : 0 }} /></div><span className="text-[10px] text-[#8f8a7d]">{item.date.slice(8)}</span><span className="sr-only">{item.date}：{item.downloads} 次下载</span></li>)}</ol></div></AdminSurface>;
}

function formatCount(value: number): string { return new Intl.NumberFormat().format(value); }
function formatNullableCount(value: number | null): string { return value === null ? '—' : formatCount(value); }
function formatTimestamp(value: string | null): string {
  if (!value) return '尚未同步';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value));
}
function sourceSummary(source: AdminDistributionAdoptionOverview['sources'][number] | undefined): string { return !source ? '尚未同步' : source.lastError ? `最近失败：${source.lastError}` : '正常'; }
function formatArtifactKind(kind: AdminDistributionAdoptionOverview['assets']['artifactKinds'][number]): string {
  return { npm_runtime_bundle: 'NPM runtime bundle', desktop_installer: 'Desktop 安装包', desktop_portable: 'Desktop 便携包', desktop_runtime_bundle: 'Desktop runtime bundle', update_metadata: '更新元数据', other: '其他发布物' }[kind];
}
