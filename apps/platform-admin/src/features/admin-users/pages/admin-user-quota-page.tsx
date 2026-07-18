import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminOverview,
  updateGlobalFreeLimit,
} from '@/api/client';
import type { AdminOverview } from '@/api/types';
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminSurface,
  AdminToolbar,
} from '@/components/admin/admin-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminUserListSection } from '@/features/admin-users/components/admin-user-list-section';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

export function AdminUserQuotaPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [globalLimitDraft, setGlobalLimitDraft] = useState('');

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token),
  });
  const setGlobalLimitMutation = useMutation({
    mutationFn: async () => {
      const fallbackValue = overviewQuery.data?.globalFreeLimitUsd ?? 20;
      const nextValue = Number(globalLimitDraft.trim().length > 0 ? globalLimitDraft : String(fallbackValue));
      await updateGlobalFreeLimit(token, nextValue);
    },
    onSuccess: async () => {
      setGlobalLimitDraft('');
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  return (
    <AdminPage className="flex flex-col gap-3 [&>*]:!mt-0 md:gap-6">
      <div className="order-2 md:order-1">
        <div className="md:space-y-4">
          <div className="hidden space-y-1 md:block">
            <h3 className="text-sm font-semibold text-[#1f1f1d]">全局额度治理</h3>
            <p className="text-sm leading-6 text-[#656561]">先看平台整体容量，再进入具体用户调整；全局事实与单用户操作保持分层。</p>
          </div>
          <GlobalQuotaCard
            overview={overviewQuery.data}
            draft={globalLimitDraft}
            errorMessage={overviewQuery.error instanceof Error ? overviewQuery.error.message : null}
            isSubmitting={setGlobalLimitMutation.isPending}
            submitErrorMessage={setGlobalLimitMutation.error instanceof Error ? setGlobalLimitMutation.error.message : null}
            onDraftChange={setGlobalLimitDraft}
            onSubmit={() => setGlobalLimitMutation.mutate()}
          />
        </div>
      </div>

      <div className="order-1 md:order-2">
        <AdminUserListSection token={token} />
      </div>
    </AdminPage>
  );
}

function GlobalQuotaCard(props: {
  overview: AdminOverview | undefined;
  draft: string;
  errorMessage: string | null;
  submitErrorMessage: string | null;
  isSubmitting: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}): JSX.Element {
  const inputValue = props.draft.trim().length > 0 ? props.draft : String(props.overview?.globalFreeLimitUsd ?? 20);
  return (
    <>
      <details className="group rounded-xl border border-[#e4e0d7] bg-white md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-200 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-[#1f1f1d]">全局额度</span>
          <span className="flex items-center gap-2 text-xs text-[#656561]">
            剩余 {formatUsd(props.overview?.globalFreeRemainingUsd ?? 0)}
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-[#eeeae1] p-3">
          {props.errorMessage ? <p className="text-sm text-rose-600">{props.errorMessage}</p> : null}
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div><dt className="text-[#7b766b]">上限</dt><dd className="mt-1 font-semibold tabular-nums text-[#1f1f1d]">{formatUsd(props.overview?.globalFreeLimitUsd ?? 0)}</dd></div>
            <div><dt className="text-[#7b766b]">已使用</dt><dd className="mt-1 font-semibold tabular-nums text-[#1f1f1d]">{formatUsd(props.overview?.globalFreeUsedUsd ?? 0)}</dd></div>
            <div><dt className="text-[#7b766b]">剩余</dt><dd className="mt-1 font-semibold tabular-nums text-[#1f1f1d]">{formatUsd(props.overview?.globalFreeRemainingUsd ?? 0)}</dd></div>
          </dl>
          <div className="flex gap-2">
            <Input value={inputValue} onChange={(event) => props.onDraftChange(event.target.value)} placeholder="新的全局额度上限" />
            <Button className="shrink-0" onClick={props.onSubmit} disabled={props.isSubmitting}>更新</Button>
          </div>
          <p className="text-xs text-[#656561]">累计用户 {props.overview?.userCount ?? 0} 位，待审核充值 {props.overview?.pendingRechargeIntents ?? 0} 笔</p>
          {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
        </div>
      </details>

      <AdminSurface className="hidden space-y-5 p-5 md:block">
        {props.errorMessage ? <p className="text-sm text-rose-600">{props.errorMessage}</p> : null}
        <AdminMetricGrid className="xl:grid-cols-3">
          <AdminMetricCard label="全局免费池上限" value={formatUsd(props.overview?.globalFreeLimitUsd ?? 0)} />
          <AdminMetricCard label="全局免费池已消耗" value={formatUsd(props.overview?.globalFreeUsedUsd ?? 0)} />
          <AdminMetricCard label="全局免费池剩余" value={formatUsd(props.overview?.globalFreeRemainingUsd ?? 0)} />
        </AdminMetricGrid>
        <AdminToolbar className="grid gap-3 lg:grid-cols-[280px_180px_minmax(0,1fr)]">
          <Input value={inputValue} onChange={(event) => props.onDraftChange(event.target.value)} placeholder="设置新的全局免费池上限" />
          <Button onClick={props.onSubmit} disabled={props.isSubmitting}>更新上限</Button>
          <div className="flex items-center text-sm text-[#656561]">累计用户 {props.overview?.userCount ?? 0} 位，待审核充值 {props.overview?.pendingRechargeIntents ?? 0} 笔</div>
        </AdminToolbar>
        {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
      </AdminSurface>
    </>
  );
}
