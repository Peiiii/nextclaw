import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminSection,
  AdminSurface,
  AdminToolbar
} from '@/components/admin/admin-page';
import {
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminUser,
  updateGlobalFreeLimit
} from '@/api/client';
import type { AdminOverview, UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
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
    <AdminPage>
      <AdminSection
        title="全局额度治理"
        description="把平台免费池和用户额度管理收敛到统一治理页面，避免在多个区块之间来回查找。"
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

      <AdminSection title="用户额度表格" description="以表格为主进行搜索、分页和行内额度调整。">
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
      </AdminSection>
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
          当前累计用户数：{props.overview?.userCount ?? 0}，待审核充值：{props.overview?.pendingRechargeIntents ?? 0}
        </div>
      </AdminToolbar>

      {props.submitErrorMessage ? <p className="text-sm text-rose-600">{props.submitErrorMessage}</p> : null}
    </AdminSurface>
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
    <AdminSurface className="space-y-4 p-5">
      <AdminToolbar
        className="flex flex-wrap gap-2"
      >
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
      </AdminToolbar>

      {props.isLoading ? <p className="text-sm text-[#8f8a7d]">加载用户中...</p> : null}
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
    </AdminSurface>
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
        <thead className="bg-[#f3f2ee] text-xs uppercase tracking-wide text-[#8f8a7d]">
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
            <tr key={user.id} className="border-t border-[#ece7dd]">
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
