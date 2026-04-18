import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminMarketplaceSkillDetail,
  fetchAdminMarketplaceSkills,
  reviewAdminMarketplaceSkill
} from '@/api/client';
import type {
  AdminMarketplaceSkillCountsView,
  AdminMarketplaceSkillDetailPayload,
  AdminMarketplaceSkillPublishStatus,
  AdminMarketplaceSkillReviewStatus,
  AdminMarketplaceSkillSummaryView
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
const STATUS_OPTIONS: Array<{ value: AdminMarketplaceSkillPublishStatus; label: string }> = [
  { value: 'pending', label: '待审核' },
  { value: 'published', label: '已发布' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'all', label: '全部' }
];

export function AdminMarketplaceReviewSection({ token, showHeader = true }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [publishStatus, setPublishStatus] = useState<AdminMarketplaceSkillPublishStatus>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSelectorCandidate, setSelectedSelectorCandidate] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: ['admin-marketplace-skills', publishStatus, searchQuery, page],
    queryFn: async () => await fetchAdminMarketplaceSkills(token, {
      publishStatus,
      q: searchQuery,
      page,
      pageSize: PAGE_SIZE
    })
  });

  const items = listQuery.data?.items ?? [];
  const selectedSelector = resolveSelectedSelector(selectedSelectorCandidate, items);
  const detailQuery = useQuery({
    queryKey: ['admin-marketplace-skill-detail', selectedSelector],
    enabled: Boolean(selectedSelector),
    queryFn: async () => await fetchAdminMarketplaceSkillDetail(token, selectedSelector ?? '')
  });

  const reviewDraft = selectedSelector
    ? reviewDrafts[selectedSelector] ?? detailQuery.data?.item.reviewNote ?? ''
    : '';
  const trimmedReviewDraft = reviewDraft.trim();

  const reviewMutation = useMutation({
    mutationFn: async (nextStatus: AdminMarketplaceSkillReviewStatus) => {
      if (!selectedSelector) {
        throw new Error('请先选择一个 skill。');
      }
      return await reviewAdminMarketplaceSkill(token, selectedSelector, {
        publishStatus: nextStatus,
        reviewNote: trimmedReviewDraft || undefined
      });
    },
    onSuccess: async (data) => {
      setSelectedSelectorCandidate(data.item.packageName);
      setReviewDrafts((prev) => ({ ...prev, [data.item.packageName]: data.item.reviewNote ?? '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace-skills'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-marketplace-skill-detail', data.item.packageName] })
      ]);
    }
  });

  return (
    <Card className="space-y-4 rounded-2xl border-[#e4e0d7] p-5 shadow-[0_1px_3px_rgba(31,31,29,0.04)]">
      {showHeader ? (
        <div className="space-y-1">
          <CardTitle>Marketplace 审核</CardTitle>
          <p className="text-sm text-[#656561]">
            这里是 skill 上架治理入口。管理员可以查看待审核队列、阅读 `SKILL.md` 与 `marketplace.json`，并直接执行通过或拒绝。
          </p>
        </div>
      ) : null}

      <MarketplaceCountsStrip counts={listQuery.data?.counts} />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <MarketplaceFilterPanel
            publishStatus={publishStatus}
            searchInput={searchInput}
            isLoading={listQuery.isLoading}
            onPublishStatusChange={(nextStatus) => {
              setPublishStatus(nextStatus);
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
            onSearchInputChange={setSearchInput}
            onSearch={() => {
              setSearchQuery(searchInput.trim());
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
            onClear={() => {
              setSearchInput('');
              setSearchQuery('');
              setPage(1);
              setSelectedSelectorCandidate(null);
            }}
          />
          <MarketplaceQueuePanel
            items={items}
            selectedSelector={selectedSelector}
            page={page}
            totalPages={listQuery.data?.totalPages ?? 0}
            total={listQuery.data?.total ?? 0}
            isLoading={listQuery.isLoading}
            errorMessage={listQuery.error instanceof Error ? listQuery.error.message : null}
            onSelect={setSelectedSelectorCandidate}
            onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() => setPage((prev) => prev + 1)}
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

function MarketplaceCountsStrip(props: { counts: AdminMarketplaceSkillCountsView | undefined }): JSX.Element {
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

function MarketplaceFilterPanel(props: {
  publishStatus: AdminMarketplaceSkillPublishStatus;
  searchInput: string;
  isLoading: boolean;
  onPublishStatusChange: (value: AdminMarketplaceSkillPublishStatus) => void;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
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
          props.onSearch();
        }}
      >
        <Input
          placeholder="搜索包名、标题、作者"
          value={props.searchInput}
          onChange={(event) => props.onSearchInputChange(event.target.value)}
        />
        <Button type="submit" variant="secondary">搜索</Button>
        <Button type="button" variant="ghost" onClick={props.onClear}>清空</Button>
      </form>
    </div>
  );
}

function MarketplaceQueuePanel(props: {
  items: AdminMarketplaceSkillSummaryView[];
  selectedSelector: string | null;
  page: number;
  totalPages: number;
  total: number;
  isLoading: boolean;
  errorMessage: string | null;
  onSelect: (selector: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-[#e4e0d7] bg-white">
      <div className="border-b border-[#e4e0d7] px-4 py-3">
        <p className="text-sm font-medium text-[#1f1f1d]">审核队列</p>
        <p className="mt-1 text-xs text-[#8f8a7d]">第 {props.page} 页，共 {Math.max(props.totalPages, 1)} 页，累计 {props.total} 个 skill。</p>
      </div>

      <div className="space-y-2 p-3">
        {props.isLoading ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">加载队列中...</p> : null}
        {props.errorMessage ? <p className="px-1 text-sm text-rose-600">{props.errorMessage}</p> : null}
        {!props.isLoading && props.items.length === 0 ? <p className="px-1 py-6 text-sm text-[#8f8a7d]">当前筛选条件下没有 skill。</p> : null}

        {props.items.map((item) => {
          const selector = item.packageName;
          const isSelected = props.selectedSelector === selector;
          return (
            <button
              key={item.id}
              type="button"
              className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                isSelected
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-[#e4e0d7] bg-[#f9f8f5] hover:border-[#d4cdbd] hover:bg-[#f3f2ee]'
              }`}
              onClick={() => props.onSelect(selector)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1f1f1d]">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-[#8f8a7d]">{item.packageName}</p>
                </div>
                <MarketplaceStatusBadge status={item.publishStatus} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[#656561]">{item.summary}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8f8a7d]">
                <span>作者：{item.author}</span>
                <span>更新：{formatDateTime(item.updatedAt)}</span>
              </div>
            </button>
          );
        })}
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

function MarketplaceDetailPanel(props: {
  detail: AdminMarketplaceSkillDetailPayload | undefined;
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
    return <Card className="text-sm text-[#8f8a7d]">加载 skill 详情中...</Card>;
  }

  if (props.errorMessage) {
    return <Card className="text-sm text-rose-600">{props.errorMessage}</Card>;
  }

  if (!props.detail) {
    return <Card className="text-sm text-[#8f8a7d]">请先从左侧选择一个 skill。</Card>;
  }

  const { item, files, skillMarkdownRaw, marketplaceJsonRaw } = props.detail;

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.name}</CardTitle>
            <p className="mt-1 text-sm text-[#8f8a7d]">{item.packageName}</p>
          </div>
          <MarketplaceStatusBadge status={item.publishStatus} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailMetaItem label="发布者" value={item.author} />
          <DetailMetaItem label="Scope" value={`@${item.ownerScope}`} />
          <DetailMetaItem label="发布时间" value={formatDateTime(item.publishedAt)} />
          <DetailMetaItem label="更新时间" value={formatDateTime(item.updatedAt)} />
          <DetailMetaItem label="最近审核" value={item.reviewedAt ? formatDateTime(item.reviewedAt) : '未审核'} />
          <DetailMetaItem label="安装命令" value={item.install.command ?? item.install.spec} />
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

        <div className="grid gap-3 md:grid-cols-2">
          <LinkMetaItem label="源码仓库" href={item.sourceRepo} />
          <LinkMetaItem label="主页" href={item.homepage} />
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>审核动作</CardTitle>
        <p className="text-sm text-[#656561]">拒绝时必须填写备注；通过时备注可选，但建议给出审核结论，便于后续治理留痕。</p>
        <Textarea
          placeholder="填写审核备注。拒绝时必填，例如缺少 metadata、命名不规范、文件不完整等。"
          value={props.reviewDraft}
          onChange={(event) => props.onReviewDraftChange(event.target.value)}
        />
        {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={props.isSubmitting} onClick={props.onApprove}>通过</Button>
          <Button variant="danger" disabled={props.isSubmitting || !props.canReject} onClick={props.onReject}>拒绝</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle>文件清单</CardTitle>
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f3f2ee] text-xs uppercase tracking-wide text-[#8f8a7d]">
              <tr>
                <th className="px-3 py-2">路径</th>
                <th className="px-3 py-2">大小</th>
                <th className="px-3 py-2">更新时间</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.path} className="border-t border-[#ece7dd]">
                  <td className="px-3 py-2 font-mono text-xs text-[#4a4944]">{file.path}</td>
                  <td className="px-3 py-2 text-[#656561]">{formatBytes(file.sizeBytes)}</td>
                  <td className="px-3 py-2 text-[#656561]">{formatDateTime(file.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <RawContentCard title="SKILL.md" raw={skillMarkdownRaw} />
      <RawContentCard title="marketplace.json" raw={marketplaceJsonRaw} />
    </div>
  );
}

function DetailMetaItem(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[#e4e0d7] bg-[#f9f8f5] p-3">
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      <p className="mt-1 text-sm text-[#1f1f1d]">{props.value}</p>
    </div>
  );
}

function LinkMetaItem(props: { label: string; href?: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[#e4e0d7] bg-[#f9f8f5] p-3">
      <p className="text-xs text-[#8f8a7d]">{props.label}</p>
      {props.href ? (
        <a className="mt-1 block break-all text-sm text-brand-700 hover:underline" href={props.href} target="_blank" rel="noreferrer">
          {props.href}
        </a>
      ) : (
        <p className="mt-1 text-sm text-[#8f8a7d]">未提供</p>
      )}
    </div>
  );
}

function RawContentCard(props: { title: string; raw?: string }): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>{props.title}</CardTitle>
      <pre className="max-h-[360px] overflow-auto rounded-lg bg-[#1f1f1d] p-4 text-xs leading-6 text-[#f6f4ee]">
        {props.raw && props.raw.trim().length > 0 ? props.raw : `未提供 ${props.title}`}
      </pre>
    </Card>
  );
}

function MarketplaceStatusBadge(props: {
  status: Exclude<AdminMarketplaceSkillPublishStatus, 'all'>;
}): JSX.Element {
  const className = props.status === 'published'
    ? 'bg-emerald-100 text-emerald-700'
    : props.status === 'rejected'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700';
  const label = props.status === 'published'
    ? '已发布'
    : props.status === 'rejected'
      ? '已拒绝'
      : '待审核';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function resolveSelectedSelector(
  selectedSelectorCandidate: string | null,
  items: AdminMarketplaceSkillSummaryView[]
): string | null {
  if (selectedSelectorCandidate && items.some((item) => item.packageName === selectedSelectorCandidate)) {
    return selectedSelectorCandidate;
  }
  return items[0]?.packageName ?? null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
