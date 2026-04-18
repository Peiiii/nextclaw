import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminUser,
  updateGlobalFreeLimit
} from '@/api/client';
import type { AdminOverview, UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

type UpdateQuotaPayload = {
  userId: string;
  freeLimitUsd?: number;
  paidBalanceDeltaUsd?: number;
};

const PAGE_SIZE = 20;

export function AdminUserQuotaPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [globalLimitDraft, setGlobalLimitDraft] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userCursorHistory, setUserCursorHistory] = useState<Array<string | null>>([]);
  const [freeLimitEdits, setFreeLimitEdits] = useState<Record<string, string>>({});
  const [paidDeltaEdits, setPaidDeltaEdits] = useState<Record<string, string>>({});

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', userSearch, userCursor],
    queryFn: async () => await fetchAdminUsers(token, {
      limit: PAGE_SIZE,
      q: userSearch,
      cursor: userCursor
    })
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
    }
  });

  const updateQuotaMutation = useMutation({
    mutationFn: async (payload: UpdateQuotaPayload) => {
      await updateAdminUser(token, payload.userId, payload);
    },
    onSuccess: async (_, payload) => {
      setFreeLimitEdits((prev) => clearEdit(prev, payload.userId));
      setPaidDeltaEdits((prev) => clearEdit(prev, payload.userId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      ]);
    }
  });

  const users = usersQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <GlobalQuotaCard
        overview={overviewQuery.data}
        draft={globalLimitDraft}
        errorMessage={overviewQuery.error instanceof Error ? overviewQuery.error.message : null}
        isSubmitting={setGlobalLimitMutation.isPending}
        submitErrorMessage={setGlobalLimitMutation.error instanceof Error ? setGlobalLimitMutation.error.message : null}
        onDraftChange={setGlobalLimitDraft}
        onSubmit={() => setGlobalLimitMutation.mutate()}
      />

      <UserQuotaManagementCard
        users={users}
        searchInput={userSearchInput}
        freeLimitEdits={freeLimitEdits}
        paidDeltaEdits={paidDeltaEdits}
        isLoading={usersQuery.isLoading}
        listErrorMessage={usersQuery.error instanceof Error ? usersQuery.error.message : null}
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
        onFreeLimitEditChange={(userId, value) => {
          setFreeLimitEdits((prev) => ({ ...prev, [userId]: value }));
        }}
        onPaidDeltaEditChange={(userId, value) => {
          setPaidDeltaEdits((prev) => ({ ...prev, [userId]: value }));
        }}
        onSaveUserQuota={(user) => {
          updateQuotaMutation.mutate(buildUpdateQuotaPayload(user, freeLimitEdits, paidDeltaEdits));
        }}
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
    </div>
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
  const inputValue = props.draft.trim().length > 0
    ? props.draft
    : String(props.overview?.globalFreeLimitUsd ?? 20);

  return (
    <Card className="space-y-4 rounded-[28px]">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Users & Quota</p>
        <CardTitle>用户与额度</CardTitle>
        <p className="text-sm text-slate-500">把用户额度、全局免费池和个人余额集中放到同一个治理页面，避免跨区块来回查找。</p>
      </div>

      {props.errorMessage ? <p className="text-sm text-rose-600">{props.errorMessage}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <QuotaSummaryCard label="全局免费池上限" value={formatUsd(props.overview?.globalFreeLimitUsd ?? 0)} />
        <QuotaSummaryCard label="全局免费池已消耗" value={formatUsd(props.overview?.globalFreeUsedUsd ?? 0)} />
        <QuotaSummaryCard label="全局免费池剩余" value={formatUsd(props.overview?.globalFreeRemainingUsd ?? 0)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_180px_minmax(0,1fr)]">
        <Input
          value={inputValue}
          onChange={(event) => props.onDraftChange(event.target.value)}
          placeholder="设置新的全局免费池上限"
        />
        <Button onClick={props.onSubmit} disabled={props.isSubmitting}>更新上限</Button>
        <div className="flex items-center text-sm text-slate-500">
          当前累计用户数：{props.overview?.userCount ?? 0}，待审核充值：{props.overview?.pendingRechargeIntents ?? 0}
        </div>
      </div>

      {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
    </Card>
  );
}

function QuotaSummaryCard(props: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{props.value}</p>
    </div>
  );
}

function UserQuotaManagementCard(props: {
  users: UserView[];
  searchInput: string;
  freeLimitEdits: Record<string, string>;
  paidDeltaEdits: Record<string, string>;
  isLoading: boolean;
  listErrorMessage: string | null;
  updateErrorMessage: string | null;
  canPrev: boolean;
  canNext: boolean;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onFreeLimitEditChange: (userId: string, value: string) => void;
  onPaidDeltaEditChange: (userId: string, value: string) => void;
  onSaveUserQuota: (user: UserView) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}): JSX.Element {
  return (
    <Card className="space-y-4 rounded-[28px]">
      <div className="space-y-1">
        <CardTitle>用户额度管理</CardTitle>
        <p className="text-sm text-slate-500">支持按用户调整个人免费额度上限，并直接增减付费余额（USD）。</p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="按邮箱搜索"
          value={props.searchInput}
          onChange={(event) => props.onSearchInputChange(event.target.value)}
        />
        <Button type="submit" variant="secondary">搜索</Button>
        <Button type="button" variant="ghost" onClick={props.onClearSearch}>清空</Button>
      </form>

      {props.isLoading ? <p className="text-sm text-slate-500">加载用户中...</p> : null}
      {props.listErrorMessage ? <p className="text-sm text-rose-600">{props.listErrorMessage}</p> : null}

      <UserQuotaTable
        users={props.users}
        freeLimitEdits={props.freeLimitEdits}
        paidDeltaEdits={props.paidDeltaEdits}
        onFreeLimitEditChange={props.onFreeLimitEditChange}
        onPaidDeltaEditChange={props.onPaidDeltaEditChange}
        onSaveUserQuota={props.onSaveUserQuota}
      />

      {props.updateErrorMessage ? <p className="text-sm text-rose-600">{props.updateErrorMessage}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" className="h-8 px-3" disabled={!props.canPrev} onClick={props.onPrevPage}>上一页</Button>
        <Button variant="secondary" className="h-8 px-3" disabled={!props.canNext} onClick={props.onNextPage}>下一页</Button>
      </div>
    </Card>
  );
}

function UserQuotaTable(props: {
  users: UserView[];
  freeLimitEdits: Record<string, string>;
  paidDeltaEdits: Record<string, string>;
  onFreeLimitEditChange: (userId: string, value: string) => void;
  onPaidDeltaEditChange: (userId: string, value: string) => void;
  onSaveUserQuota: (user: UserView) => void;
}): JSX.Element {
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
          {props.users.map((user) => (
            <tr key={user.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{user.email}</td>
              <td className="px-3 py-2">{user.role}</td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 w-28"
                  value={props.freeLimitEdits[user.id] ?? String(user.freeLimitUsd)}
                  onChange={(event) => props.onFreeLimitEditChange(user.id, event.target.value)}
                />
              </td>
              <td className="px-3 py-2">{formatUsd(user.freeRemainingUsd)}</td>
              <td className="px-3 py-2">{formatUsd(user.paidBalanceUsd)}</td>
              <td className="px-3 py-2">
                <Input
                  className="h-8 w-28"
                  placeholder="如 10 / -5"
                  value={props.paidDeltaEdits[user.id] ?? '0'}
                  onChange={(event) => props.onPaidDeltaEditChange(user.id, event.target.value)}
                />
              </td>
              <td className="px-3 py-2">
                <Button variant="secondary" className="h-8 px-2" onClick={() => props.onSaveUserQuota(user)}>保存</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function buildUpdateQuotaPayload(
  user: UserView,
  freeLimitEdits: Record<string, string>,
  paidDeltaEdits: Record<string, string>
): UpdateQuotaPayload {
  const freeLimitRaw = Number(freeLimitEdits[user.id] ?? String(user.freeLimitUsd));
  const paidDeltaRaw = Number(paidDeltaEdits[user.id] ?? '0');
  const payload: UpdateQuotaPayload = { userId: user.id };

  if (Number.isFinite(freeLimitRaw) && freeLimitRaw >= 0) {
    payload.freeLimitUsd = freeLimitRaw;
  }
  if (Number.isFinite(paidDeltaRaw) && paidDeltaRaw !== 0) {
    payload.paidBalanceDeltaUsd = paidDeltaRaw;
  }

  return payload;
}

function clearEdit(edits: Record<string, string>, key: string): Record<string, string> {
  if (!(key in edits)) {
    return edits;
  }
  const next = { ...edits };
  delete next[key];
  return next;
}
