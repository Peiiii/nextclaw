import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminMarketplaceAppDetail,
  fetchAdminMarketplaceApps,
  reviewAdminMarketplaceApp
} from '@/api/client';
import type {
  AdminMarketplaceAppCountsView,
  AdminMarketplaceAppDetailPayload,
  AdminMarketplaceAppPublishStatus,
  AdminMarketplaceAppReviewStatus,
  AdminMarketplaceAppSummaryView
} from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  token: string;
  showHeader?: boolean;
};

const PAGE_SIZE = 12;
const STATUS_OPTIONS: Array<{ value: AdminMarketplaceAppPublishStatus; label: string }> = [
  { value: 'pending', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'all', label: '全部' }
];

export function AdminMarketplaceAppReviewSection({ token, showHeader = true }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [publishStatus, setPublishStatus] = useState<AdminMarketplaceAppPublishStatus>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSelectorCandidate, setSelectedSelectorCandidate] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: ['admin-marketplace-apps', publishStatus, searchQuery, page],
    queryFn: async () => await fetchAdminMarketplaceApps(token, {
      publishStatus,
      q: searchQuery,
      page,
      pageSize: PAGE_SIZE
    })
  });

  const items = listQuery.data?.items ?? [];
  const selectedSelector = resolveSelectedSelector(selectedSelectorCandidate, items);
  const detailQuery = useQuery({
    queryKey: ['admin-marketplace-app-detail', selectedSelector],
    enabled: Boolean(selectedSelector),
    queryFn: async () => await fetchAdminMarketplaceAppDetail(token, selectedSelector ?? '')
  });

  const reviewDraft = selectedSelector
    ? reviewDrafts[selectedSelector] ?? detailQuery.data?.item.reviewNote ?? ''
    : '';
  const trimmedReviewDraft = reviewDraft.trim();

  const reviewMutation = useMutation({
    mutationFn: async (nextStatus: AdminMarketplaceAppReviewStatus) => {
      if (!selectedSelector) {
        throw new Error('请先选择一个 app。');
      }
      return await reviewAdminMarketplaceApp(token, selectedSelector, {
        publishStatus: nextStatus,
        reviewNote: trimmedReviewDraft || undefined
      });
    },
    onSuccess: async (data) => {
      setSelectedSelectorCandidate(data.item.appId);
      setReviewDrafts((prev) => ({ ...prev, [data.item.appId]: data.item.reviewNote ?? '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace-apps'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace-app-detail', data.item.appId] })
      ]);
    }
  });

  return (
    <Card className="space-y-4 rounded-2xl border-[#e4e0d7] p-5 shadow-[0_1px_3px_rgba(31,31,29,0.04)]">
      {showHeader ? <MarketplaceReviewHeader /> : null}

      <MarketplaceCountsStrip counts={listQuery.data?.counts} />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <MarketplaceFilterPanel
            isLoading={listQuery.isLoading}
            publishStatus={publishStatus}
            searchInput={searchInput}
            onPublishStatusChange={(value) => {
              setPublishStatus(value);
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
            onSearchInputChange={setSearchInput}
            onSearchSubmit={() => {
              setSearchQuery(searchInput.trim());
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
            onSearchClear={() => {
              setSearchInput('');
              setSearchQuery('');
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
          />
          <MarketplaceQueuePanel
            items={items}
            page={page}
            total={listQuery.data?.total ?? 0}
            totalPages={Math.max(listQuery.data?.totalPages ?? 0, 1)}
            selectedSelector={selectedSelector}
            isLoading={listQuery.isLoading}
            errorMessage={listQuery.error instanceof Error ? listQuery.error.message : null}
            onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() => setPage((prev) => prev + 1)}
            onSelect={setSelectedSelectorCandidate}
          />
        </div>

        <MarketplaceDetailPanel
          detail={detailQuery.data}
          isLoading={detailQuery.isLoading}
          errorMessage={detailQuery.error instanceof Error ? detailQuery.error.message : null}
          reviewDraft={reviewDraft}
          canReject={trimmedReviewDraft.length > 0}
          isSubmitting={reviewMutation.isPending}
          submitErrorMessage={reviewMutation.error instanceof Error ? reviewMutation.error.message : null}
          onReviewDraftChange={(value) => {
            if (!selectedSelector) {
              return;
            }
            setReviewDrafts((prev) => ({ ...prev, [selectedSelector]: value }));
          }}
          onApprove={() => reviewMutation.mutate('published')}
          onReject={() => reviewMutation.mutate('rejected')}
        />
      </div>
    </Card>
  );
}

function MarketplaceReviewHeader(): JSX.Element {
  return (
    <div className="space-y-1">
      <CardTitle>Apps 审核</CardTitle>
      <p className="text-sm text-[#656561]">
        这里是 NextClaw Apps 上架治理入口。管理员可以查看待审核队列、阅读 README 与 `marketplace.json`，并直接执行通过或拒绝。
      </p>
    </div>
  );
}

function MarketplaceFilterPanel(props: {
  isLoading: boolean;
  publishStatus: AdminMarketplaceAppPublishStatus;
  searchInput: string;
  onPublishStatusChange: (value: AdminMarketplaceAppPublishStatus) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <p className="text-sm font-medium text-[#1f1f1d]">筛选队列</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={props.publishStatus === option.value ? 'primary' : 'secondary'}
            className="h-8 px-3"
            disabled={props.isLoading}
            onClick={() => props.onPublishStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearchSubmit();
        }}
      >
        <Input
          placeholder="搜索 appId、标题、作者"
          value={props.searchInput}
          onChange={(event) => props.onSearchInputChange(event.target.value)}
        />
        <Button type="submit" variant="secondary">搜索</Button>
        <Button type="button" variant="ghost" onClick={props.onSearchClear}>
          清空
        </Button>
      </form>
    </div>
  );
}

function MarketplaceQueuePanel(props: {
  items: AdminMarketplaceAppSummaryView[];
  page: number;
  total: number;
  totalPages: number;
  selectedSelector: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelect: (selector: string) => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-white">
      <div className="border-b border-[#e4e0d7] px-4 py-3">
        <p className="text-sm font-medium text-[#1f1f1d]">审核队列</p>
        <p className="mt-1 text-xs text-[#8f8a7d]">
          第 {props.page} 页，共 {props.totalPages} 页，累计 {props.total} 个 app。
        </p>
      </div>

      <div className="space-y-2 p-3">
        {props.isLoading ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">加载队列中...</p> : null}
        {props.errorMessage ? <p className="px-1 text-sm text-rose-600">{props.errorMessage}</p> : null}
        {!props.isLoading && props.items.length === 0 ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">当前筛选条件下没有 app。</p> : null}
        {props.items.map((item) => (
          <MarketplaceQueueItem
            key={item.id}
            item={item}
            isSelected={props.selectedSelector === item.appId}
            onSelect={props.onSelect}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#e4e0d7] px-3 py-3">
        <Button variant="ghost" className="h-8 px-3" disabled={props.page <= 1} onClick={props.onPrevPage}>上一页</Button>
        <Button
          variant="secondary"
          className="h-8 px-3"
          disabled={props.totalPages === 0 || props.page >= props.totalPages}
          onClick={props.onNextPage}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function MarketplaceQueueItem(props: {
  item: AdminMarketplaceAppSummaryView;
  isSelected: boolean;
  onSelect: (selector: string) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
        props.isSelected
          ? 'border-brand-300 bg-brand-50'
          : 'border-[#e4e0d7] bg-[#f9f8f5] hover:border-[#d4cdbd] hover:bg-[#f3f2ee]'
      }`}
      onClick={() => props.onSelect(props.item.appId)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1f1f1d]">{props.item.name}</p>
          <p className="mt-1 truncate text-xs text-[#8f8a7d]">{props.item.appId}</p>
        </div>
        <MarketplaceStatusBadge status={props.item.publishStatus} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[#656561]">{props.item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8f8a7d]">
        <span>作者：{props.item.author}</span>
        <span>Scope：@{props.item.ownerScope}</span>
      </div>
    </button>
  );
}

function MarketplaceCountsStrip(props: { counts: AdminMarketplaceAppCountsView | undefined }): JSX.Element {
  const counts = props.counts ?? { pending: 0, published: 0, rejected: 0 };
  const items = [
    { label: '待审核', value: counts.pending },
    { label: '已发布', value: counts.published },
    { label: '已拒绝', value: counts.rejected }
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8f8a7d]">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#1f1f1d]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function MarketplaceDetailPanel(props: {
  detail: AdminMarketplaceAppDetailPayload | undefined;
  isLoading: boolean;
  errorMessage: string | null;
  reviewDraft: string;
  canReject: boolean;
  isSubmitting: boolean;
  submitErrorMessage: string | null;
  onReviewDraftChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}): JSX.Element {
  if (props.isLoading) {
    return <Card className="text-sm text-[#8f8a7d]">加载 app 详情中...</Card>;
  }

  if (props.errorMessage) {
    return <Card className="text-sm text-rose-600">{props.errorMessage}</Card>;
  }

  if (!props.detail) {
    return <Card className="text-sm text-[#8f8a7d]">请先从左侧选择一个 app。</Card>;
  }

  const { item, files, readmeRaw, marketplaceJsonRaw } = props.detail;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.name}</CardTitle>
            <p className="mt-1 text-sm text-[#8f8a7d]">{item.appId}</p>
          </div>
          <MarketplaceStatusBadge status={item.publishStatus} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailMetaItem label="发布者" value={item.author} />
          <DetailMetaItem label="Scope" value={`@${item.ownerScope}`} />
          <DetailMetaItem label="发布时间" value={formatDateTime(item.publishedAt)} />
          <DetailMetaItem label="更新时间" value={formatDateTime(item.updatedAt)} />
          <DetailMetaItem label="最近审核" value={item.reviewedAt ? formatDateTime(item.reviewedAt) : '未审核'} />
          <DetailMetaItem label="安装命令" value={item.install.command} />
        </div>

        <div>
          <p className="text-xs text-[#8f8a7d]">摘要</p>
          <p className="mt-1 text-sm text-[#656561]">{item.summary}</p>
        </div>

        {item.description ? (
          <div>
            <p className="text-xs text-[#8f8a7d]">描述</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#656561]">{item.description}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#f3f2ee] px-2.5 py-1 text-xs text-[#656561]">{tag}</span>
          ))}
        </div>

        <div>
          <p className="text-xs text-[#8f8a7d]">审核备注</p>
          <Textarea value={props.reviewDraft} onChange={(event) => props.onReviewDraftChange(event.target.value)} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={props.isSubmitting} onClick={props.onApprove}>通过</Button>
          <Button variant="secondary" disabled={props.isSubmitting || !props.canReject} onClick={props.onReject}>拒绝</Button>
          <Button variant="ghost" onClick={() => window.open(item.webUrl, '_blank', 'noopener,noreferrer')}>打开详情页</Button>
        </div>

        {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
      </Card>

      <Card className="space-y-3">
        <CardTitle>发布文件</CardTitle>
        <TableWrap>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[#8f8a7d]">
                <th className="px-3 py-2 font-medium">路径</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium">大小</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.path} className="border-t border-[#f0ede6]">
                  <td className="px-3 py-2">{file.path}</td>
                  <td className="px-3 py-2">{file.contentType}</td>
                  <td className="px-3 py-2">{file.sizeBytes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {readmeRaw ? (
        <Card className="space-y-2">
          <CardTitle>README</CardTitle>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#f9f8f5] p-4 text-xs text-[#444]">{readmeRaw}</pre>
        </Card>
      ) : null}

      {marketplaceJsonRaw ? (
        <Card className="space-y-2">
          <CardTitle>marketplace.json</CardTitle>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#f9f8f5] p-4 text-xs text-[#444]">{marketplaceJsonRaw}</pre>
        </Card>
      ) : null}
    </div>
  );
}

function DetailMetaItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-[#f9f8f5] p-4">
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      <p className="mt-1 break-all text-sm text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function MarketplaceStatusBadge(props: { status: AdminMarketplaceAppSummaryView['publishStatus'] }): JSX.Element {
  const className = props.status === 'published'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : props.status === 'rejected'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  const label = props.status === 'published' ? '已发布' : props.status === 'rejected' ? '已拒绝' : '待审核';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function resolveSelectedSelector(
  candidate: string | null,
  items: AdminMarketplaceAppSummaryView[]
): string | null {
  if (candidate && items.some((item) => item.appId === candidate)) {
    return candidate;
  }
  return items[0]?.appId ?? null;
}

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}
