import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmRechargeIntent,
  fetchAdminRemoteQuotaSummary,
  fetchAdminOverview,
  fetchAdminRechargeIntents,
  fetchAdminUsers,
  rejectRechargeIntent,
  updateAdminUser,
  updateGlobalFreeLimit
} from '@/api/client';
import type { AdminOverview, AdminRemoteQuotaSummary, RechargeIntentItem, UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd } from '@/lib/utils';
import { GatewayBusinessLoopSection } from '@/pages/admin-gateway-business-loop';
import { AdminMarketplaceReviewSection } from '@/pages/admin-marketplace-review-section';

type Props = {
  token: string;
};

type IntentStatus = 'all' | 'pending' | 'confirmed' | 'rejected';

type UpdateQuotaPayload = {
  userId: string;
  freeLimitUsd?: number;
  paidBalanceDeltaUsd?: number;
};

type DraftSetter = (updater: (prev: Record<string, string>) => Record<string, string>) => void;
type UpdateQuotaMutate = (payload: UpdateQuotaPayload, options: { onSuccess?: () => void }) => void;

type OverviewCardProps = {
  overview: AdminOverview | undefined;
  globalLimitInput: string;
  isSubmitting: boolean;
  onGlobalLimitInputChange: (value: string) => void;
  onSubmit: () => void;
};

type RemoteQuotaOverviewCardProps = {
  summary: AdminRemoteQuotaSummary | undefined;
  isLoading: boolean;
  errorMessage: string | null;
};

type UserQuotaManagementCardProps = {
  users: UserView[];
  searchInput: string;
  freeLimitDrafts: Record<string, string>;
  paidDeltaDrafts: Record<string, string>;
  updateErrorMessage: string | null;
  canPrev: boolean;
  canNext: boolean;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onFreeLimitDraftChange: (userId: string, value: string) => void;
  onPaidDeltaDraftChange: (userId: string, value: string) => void;
  onSaveUserQuota: (user: UserView) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

type RechargeReviewCardProps = {
  status: IntentStatus;
  intents: RechargeIntentItem[];
  canPrev: boolean;
  canNext: boolean;
  onStatusChange: (nextStatus: IntentStatus) => void;
  onConfirm: (intentId: string) => void;
  onReject: (intentId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function AdminDashboardPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [globalLimitInput, setGlobalLimitInput] = useState('20');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userCursorHistory, setUserCursorHistory] = useState<Array<string | null>>([]);
  const [intentStatus, setIntentStatus] = useState<IntentStatus>('pending');
  const [intentCursor, setIntentCursor] = useState<string | null>(null);
  const [intentCursorHistory, setIntentCursorHistory] = useState<Array<string | null>>([]);
  const [freeLimitDrafts, setFreeLimitDrafts] = useState<Record<string, string>>({});
  const [paidDeltaDrafts, setPaidDeltaDrafts] = useState<Record<string, string>>({});
  const pageSize = 20;

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const remoteQuotaQuery = useQuery({
    queryKey: ['admin-remote-quota'],
    queryFn: async () => await fetchAdminRemoteQuotaSummary(token)
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', userSearch, userCursor],
    queryFn: async () => await fetchAdminUsers(token, { limit: pageSize, q: userSearch, cursor: userCursor })
  });
  const intentsQuery = useQuery({
    queryKey: ['admin-intents', intentStatus, intentCursor],
    queryFn: async () => await fetchAdminRechargeIntents(token, { limit: pageSize, status: intentStatus, cursor: intentCursor })
  });
  const setGlobalLimitMutation = useMutation({
    mutationFn: async () => {
      await updateGlobalFreeLimit(token, Number(globalLimitInput));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    }
  });
  const updateQuotaMutation = useMutation({
    mutationFn: async (payload: UpdateQuotaPayload) => {
      await updateAdminUser(token, payload.userId, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      ]);
    }
  });
  const confirmIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await confirmRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-intents'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      ]);
    }
  });
  const rejectIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await rejectRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intents'] });
    }
  });
  const users = usersQuery.data?.items ?? [];
  const intents = intentsQuery.data?.items ?? [];
  useInitializeQuotaDrafts(users, setFreeLimitDrafts, setPaidDeltaDrafts);
  const handleSaveUserQuota = createUserQuotaSaveHandler(freeLimitDrafts, paidDeltaDrafts, updateQuotaMutation.mutate, setPaidDeltaDrafts);
  return (
    <div className="space-y-6">
      <OverviewCard
        overview={overviewQuery.data}
        globalLimitInput={globalLimitInput}
        isSubmitting={setGlobalLimitMutation.isPending}
        onGlobalLimitInputChange={setGlobalLimitInput}
        onSubmit={() => setGlobalLimitMutation.mutate()}
      />
      <RemoteQuotaOverviewCard
        summary={remoteQuotaQuery.data}
        isLoading={remoteQuotaQuery.isLoading}
        errorMessage={remoteQuotaQuery.error instanceof Error ? remoteQuotaQuery.error.message : null}
      />
      <GatewayBusinessLoopSection token={token} />
      <AdminMarketplaceReviewSection token={token} />
      <UserQuotaManagementCard
        users={users}
        searchInput={userSearchInput}
        freeLimitDrafts={freeLimitDrafts}
        paidDeltaDrafts={paidDeltaDrafts}
        updateErrorMessage={updateQuotaMutation.error instanceof Error ? updateQuotaMutation.error.message : null}
        canPrev={userCursorHistory.length > 0}
        canNext={Boolean(usersQuery.data?.hasMore && usersQuery.data?.nextCursor)}
        onSearchInputChange={setUserSearchInput}
        onSearch={() => {
          setUserSearch(userSearchInput.trim());
          setUserCursor(null);
          setUserCursorHistory([]);
        }}
        onClearSearch={() => {
          setUserSearchInput('');
          setUserSearch('');
          setUserCursor(null);
          setUserCursorHistory([]);
        }}
        onFreeLimitDraftChange={(userId, value) => {
          setFreeLimitDrafts((prev) => ({ ...prev, [userId]: value }));
        }}
        onPaidDeltaDraftChange={(userId, value) => {
          setPaidDeltaDrafts((prev) => ({ ...prev, [userId]: value }));
        }}
        onSaveUserQuota={handleSaveUserQuota}
        onPrevPage={() => {
          const previous = userCursorHistory[userCursorHistory.length - 1] ?? null;
          setUserCursor(previous);
          setUserCursorHistory((prev) => prev.slice(0, -1));
        }}
        onNextPage={() => {
          setUserCursorHistory((prev) => [...prev, userCursor]);
          setUserCursor(usersQuery.data?.nextCursor ?? null);
        }}
      />
      <RechargeReviewCard
        status={intentStatus}
        intents={intents}
        canPrev={intentCursorHistory.length > 0}
        canNext={Boolean(intentsQuery.data?.hasMore && intentsQuery.data?.nextCursor)}
        onStatusChange={(nextStatus) => {
          setIntentStatus(nextStatus);
          setIntentCursor(null);
          setIntentCursorHistory([]);
        }}
        onConfirm={(intentId) => confirmIntentMutation.mutate(intentId)}
        onReject={(intentId) => rejectIntentMutation.mutate(intentId)}
        onPrevPage={() => {
          const previous = intentCursorHistory[intentCursorHistory.length - 1] ?? null;
          setIntentCursor(previous);
          setIntentCursorHistory((prev) => prev.slice(0, -1));
        }}
        onNextPage={() => {
          setIntentCursorHistory((prev) => [...prev, intentCursor]);
          setIntentCursor(intentsQuery.data?.nextCursor ?? null);
        }}
      />
    </div>
  );
}

function useInitializeQuotaDrafts(users: UserView[], setFreeLimitDrafts: DraftSetter, setPaidDeltaDrafts: DraftSetter): void {
  useEffect(() => {
    if (users.length === 0) {
      return;
    }
    setFreeLimitDrafts((prev) => {
      const next = { ...prev };
      for (const user of users) {
        if (!(user.id in next)) {
          next[user.id] = String(user.freeLimitUsd);
        }
      }
      return next;
    });
    setPaidDeltaDrafts((prev) => {
      const next = { ...prev };
      for (const user of users) {
        if (!(user.id in next)) {
          next[user.id] = '0';
        }
      }
      return next;
    });
  }, [users, setFreeLimitDrafts, setPaidDeltaDrafts]);
}

function buildUpdateQuotaPayload(
  user: UserView,
  freeLimitDrafts: Record<string, string>,
  paidDeltaDrafts: Record<string, string>
): UpdateQuotaPayload {
  const freeLimitRaw = Number(freeLimitDrafts[user.id] ?? String(user.freeLimitUsd));
  const paidDeltaRaw = Number(paidDeltaDrafts[user.id] ?? '0');
  const payload: UpdateQuotaPayload = { userId: user.id };
  if (Number.isFinite(freeLimitRaw) && freeLimitRaw >= 0) {
    payload.freeLimitUsd = freeLimitRaw;
  }
  if (Number.isFinite(paidDeltaRaw) && paidDeltaRaw !== 0) {
    payload.paidBalanceDeltaUsd = paidDeltaRaw;
  }
  return payload;
}

function createUserQuotaSaveHandler(
  freeLimitDrafts: Record<string, string>,
  paidDeltaDrafts: Record<string, string>,
  mutate: UpdateQuotaMutate,
  setPaidDeltaDrafts: DraftSetter
): (user: UserView) => void {
  return (user) => {
    const payload = buildUpdateQuotaPayload(user, freeLimitDrafts, paidDeltaDrafts);
    mutate(payload, {
      onSuccess: () => {
        setPaidDeltaDrafts((prev) => ({ ...prev, [user.id]: '0' }));
      }
    });
  };
}

function OverviewCard({
  overview,
  globalLimitInput,
  isSubmitting,
  onGlobalLimitInputChange,
  onSubmit
}: OverviewCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>平台总览</CardTitle>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">全局免费池上限</p>
          <p className="mt-1 text-lg font-semibold">{formatUsd(overview?.globalFreeLimitUsd ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">全局免费池已消耗</p>
          <p className="mt-1 text-lg font-semibold">{formatUsd(overview?.globalFreeUsedUsd ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">用户数</p>
          <p className="mt-1 text-lg font-semibold">{overview?.userCount ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">待审核充值</p>
          <p className="mt-1 text-lg font-semibold">{overview?.pendingRechargeIntents ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[220px_160px]">
        <Input
          value={globalLimitInput}
          onChange={(event) => onGlobalLimitInputChange(event.target.value)}
          placeholder="设置新全局免费池上限"
        />
        <Button onClick={onSubmit} disabled={isSubmitting}>更新上限</Button>
      </div>
    </Card>
  );
}

function RemoteQuotaOverviewCard({
  summary,
  isLoading,
  errorMessage
}: RemoteQuotaOverviewCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>Remote 额度总览</CardTitle>
      <p className="text-sm text-slate-500">
        这里展示平台 remote 的总预算、已用量、剩余额度，以及当前默认用户额度。平台预算会先扣除 {summary?.reservePercent ?? 0}% 安全预留后再参与实际放量。
      </p>

      {isLoading ? <p className="text-sm text-slate-500">加载额度中...</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
      {summary ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminQuotaMetricCard
                title="平台 Worker 日预算"
                configuredLimit={summary.workerRequests.configuredLimit}
                enforcedLimit={summary.workerRequests.enforcedLimit}
                used={summary.workerRequests.used}
                remaining={summary.workerRequests.remaining}
                unitLabel="次"
              />
              <AdminQuotaMetricCard
                title="平台 Durable Object 日预算"
                configuredLimit={summary.durableObjectRequests.configuredLimit}
                enforcedLimit={summary.durableObjectRequests.enforcedLimit}
                used={summary.durableObjectRequests.used}
                remaining={summary.durableObjectRequests.remaining}
                unitLabel="请求单位"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">默认 remote 配置</p>
              <dl className="mt-3 space-y-3 text-sm">
                <QuotaMetaRow label="默认用户 Worker 日额度" value={`${formatQuotaNumber(summary.defaultUserWorkerBudget)} 次`} />
                <QuotaMetaRow label="默认用户 DO 日额度" value={`${formatQuotaNumber(summary.defaultUserDoBudget)} 请求单位`} />
                <QuotaMetaRow label="每分钟 session 上限" value={`${formatQuotaNumber(summary.sessionRequestsPerMinute)} 次`} />
                <QuotaMetaRow label="单实例连接上限" value={`${formatQuotaNumber(summary.instanceConnectionsPerInstance)} 个`} />
                <QuotaMetaRow label="今日重置时间" value={new Date(summary.resetsAt).toLocaleString()} />
              </dl>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}

function AdminQuotaMetricCard(props: {
  title: string;
  configuredLimit: number;
  enforcedLimit: number;
  used: number;
  remaining: number;
  unitLabel: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">{props.title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">
        {formatQuotaNumber(props.used)}
        <span className="ml-2 text-sm font-medium text-slate-500">/ {formatQuotaNumber(props.enforcedLimit)} {props.unitLabel}</span>
      </p>
      <div className="mt-3 space-y-1 text-sm text-slate-500">
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
      <dd className="font-medium text-slate-900">{props.value}</dd>
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

function UserQuotaManagementCard({
  users,
  searchInput,
  freeLimitDrafts,
  paidDeltaDrafts,
  updateErrorMessage,
  canPrev,
  canNext,
  onSearchInputChange,
  onSearch,
  onClearSearch,
  onFreeLimitDraftChange,
  onPaidDeltaDraftChange,
  onSaveUserQuota,
  onPrevPage,
  onNextPage
}: UserQuotaManagementCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>用户额度管理（免费额度 + 付费余额）</CardTitle>
      <p className="text-sm text-slate-500">支持按用户调整个人免费额度上限，以及直接增减付费余额（USD）。</p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="按邮箱搜索"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
        />
        <Button type="submit" variant="secondary">搜索</Button>
        <Button type="button" variant="ghost" onClick={onClearSearch}>清空</Button>
      </form>

      <UserQuotaTable
        users={users}
        freeLimitDrafts={freeLimitDrafts}
        paidDeltaDrafts={paidDeltaDrafts}
        onFreeLimitDraftChange={onFreeLimitDraftChange}
        onPaidDeltaDraftChange={onPaidDeltaDraftChange}
        onSaveUserQuota={onSaveUserQuota}
      />

      {updateErrorMessage ? <p className="text-sm text-rose-600">{updateErrorMessage}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" className="h-8 px-3" disabled={!canPrev} onClick={onPrevPage}>上一页</Button>
        <Button variant="secondary" className="h-8 px-3" disabled={!canNext} onClick={onNextPage}>下一页</Button>
      </div>
    </Card>
  );
}

type UserQuotaTableProps = {
  users: UserView[];
  freeLimitDrafts: Record<string, string>;
  paidDeltaDrafts: Record<string, string>;
  onFreeLimitDraftChange: (userId: string, value: string) => void;
  onPaidDeltaDraftChange: (userId: string, value: string) => void;
  onSaveUserQuota: (user: UserView) => void;
};

function UserQuotaTable({
  users,
  freeLimitDrafts,
  paidDeltaDrafts,
  onFreeLimitDraftChange,
  onPaidDeltaDraftChange,
  onSaveUserQuota
}: UserQuotaTableProps): JSX.Element {
  return (
    <TableWrap>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">邮箱</th>
            <th className="px-3 py-2">角色</th>
            <th className="px-3 py-2">免费上限</th>
            <th className="px-3 py-2">免费剩余</th>
            <th className="px-3 py-2">付费余额</th>
            <th className="px-3 py-2">余额增减</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{user.email}</td>
              <td className="px-3 py-2">{user.role}</td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 w-28"
                  value={freeLimitDrafts[user.id] ?? String(user.freeLimitUsd)}
                  onChange={(event) => onFreeLimitDraftChange(user.id, event.target.value)}
                />
              </td>
              <td className="px-3 py-2">{formatUsd(user.freeRemainingUsd)}</td>
              <td className="px-3 py-2">{formatUsd(user.paidBalanceUsd)}</td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 w-28"
                  placeholder="如 10 / -5"
                  value={paidDeltaDrafts[user.id] ?? '0'}
                  onChange={(event) => onPaidDeltaDraftChange(user.id, event.target.value)}
                />
              </td>
              <td className="px-3 py-2">
                <Button variant="secondary" className="h-8 px-2" onClick={() => onSaveUserQuota(user)}>保存</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function RechargeReviewCard({
  status,
  intents,
  canPrev,
  canNext,
  onStatusChange,
  onConfirm,
  onReject,
  onPrevPage,
  onNextPage
}: RechargeReviewCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>充值审核</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={status === 'pending' ? 'secondary' : 'ghost'}
          className="h-8 px-3"
          onClick={() => onStatusChange('pending')}
        >
          待处理
        </Button>
        <Button
          variant={status === 'all' ? 'secondary' : 'ghost'}
          className="h-8 px-3"
          onClick={() => onStatusChange('all')}
        >
          全部
        </Button>
      </div>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">申请时间</th>
              <th className="px-3 py-2">用户</th>
              <th className="px-3 py-2">金额</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {intents.map((intent) => (
              <tr key={intent.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{new Date(intent.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{intent.userId}</td>
                <td className="px-3 py-2">{formatUsd(intent.amountUsd)}</td>
                <td className="px-3 py-2">{intent.status}</td>
                <td className="px-3 py-2">
                  {intent.status === 'pending' ? (
                    <div className="flex gap-2">
                      <Button className="h-8 px-2" onClick={() => onConfirm(intent.id)}>通过</Button>
                      <Button variant="danger" className="h-8 px-2" onClick={() => onReject(intent.id)}>拒绝</Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">已处理</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" className="h-8 px-3" disabled={!canPrev} onClick={onPrevPage}>上一页</Button>
        <Button variant="secondary" className="h-8 px-3" disabled={!canNext} onClick={onNextPage}>下一页</Button>
      </div>
    </Card>
  );
}
