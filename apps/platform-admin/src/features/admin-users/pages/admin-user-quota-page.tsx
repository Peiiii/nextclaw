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
  AdminSection,
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
    <AdminPage>
      <AdminSection
        title="全局额度治理"
        description="先看平台整体容量，再进入具体用户调整；全局事实与单用户操作保持分层。"
      >
        <GlobalQuotaCard
          overview={overviewQuery.data}
          draft={globalLimitDraft}
          errorMessage={overviewQuery.error instanceof Error ? overviewQuery.error.message : null}
          isSubmitting={setGlobalLimitMutation.isPending}
          submitErrorMessage={setGlobalLimitMutation.error instanceof Error ? setGlobalLimitMutation.error.message : null}
          onDraftChange={setGlobalLimitDraft}
          onSubmit={() => setGlobalLimitMutation.mutate()}
        />
      </AdminSection>

      <AdminUserListSection token={token} />
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
    <AdminSurface className="space-y-5 p-5">
      {props.errorMessage ? <p className="text-sm text-rose-600">{props.errorMessage}</p> : null}
      <AdminMetricGrid className="xl:grid-cols-3">
        <AdminMetricCard label="全局免费池上限" value={formatUsd(props.overview?.globalFreeLimitUsd ?? 0)} />
        <AdminMetricCard label="全局免费池已消耗" value={formatUsd(props.overview?.globalFreeUsedUsd ?? 0)} />
        <AdminMetricCard label="全局免费池剩余" value={formatUsd(props.overview?.globalFreeRemainingUsd ?? 0)} />
      </AdminMetricGrid>
      <AdminToolbar className="grid gap-3 lg:grid-cols-[280px_180px_minmax(0,1fr)]">
        <Input
          value={inputValue}
          onChange={(event) => props.onDraftChange(event.target.value)}
          placeholder="设置新的全局免费池上限"
        />
        <Button onClick={props.onSubmit} disabled={props.isSubmitting}>更新上限</Button>
        <div className="flex items-center text-sm text-[#656561]">
          累计用户 {props.overview?.userCount ?? 0} 位，待审核充值 {props.overview?.pendingRechargeIntents ?? 0} 笔
        </div>
      </AdminToolbar>
      {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
    </AdminSurface>
  );
}
