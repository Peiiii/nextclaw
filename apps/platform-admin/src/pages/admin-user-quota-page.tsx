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
import { compactId, formatDateTime, formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

type UpdateQuotaPayload = {
  userId: string;
  freeLimitUsd?: number;
  paidBalanceDeltaUsd?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

export function AdminUserQuotaPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [globalLimitDraft, setGlobalLimitDraft] = useState('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [userCursorHistory, setUserCursorHistory] = useState<Array<string | null>>([]);
  const [freeLimitEdits, setFreeLimitEdits] = useState<Record<string, string>>({});
  const [paidDeltaEdits, setPaidDeltaEdits] = useState<Record<string, string>>({});

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => await fetchAdminOverview(token)
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', userSearch, pageSize, userCursor],
    queryFn: async () => await fetchAdminUsers(token, {
      limit: pageSize,
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

  const usersPage = usersQuery.data;
  const users = usersPage?.items ?? [];
  const currentPage = userCursorHistory.length + 1;
  const totalUsers = usersPage?.total ?? (userSearch ? users.length : overviewQuery.data?.userCount ?? 0);
  const currentPageStart = totalUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const currentPageEnd = totalUsers === 0 ? 0 : currentPageStart + users.length - 1;
  const currentPageAdminCount = users.filter((user) => user.role === 'admin').length;
  const currentPageUserCount = users.length - currentPageAdminCount;
  const savingUserId = updateQuotaMutation.isPending ? updateQuotaMutation.variables?.userId ?? null : null;

  const resetUserListState = (): void => {
    setUserCursor(null);
    setUserCursorHistory([]);
  };

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

      <AdminSection
        title="用户额度表格"
        description="支持按账号检索、查看注册时间与额度状态，并在同一页完成额度治理。"
      >
        <UserQuotaManagementCard
          users={users}
          totalUsers={totalUsers}
          pageSize={pageSize}
          currentPage={currentPage}
          currentPageStart={currentPageStart}
          currentPageEnd={currentPageEnd}
          currentPageAdminCount={currentPageAdminCount}
          currentPageUserCount={currentPageUserCount}
          activeSearch={userSearch}
          searchInput={userSearchInput}
          freeLimitEdits={freeLimitEdits}
          paidDeltaEdits={paidDeltaEdits}
          savingUserId={savingUserId}
          isLoading={usersQuery.isLoading}
          listErrorMessage={usersQuery.error instanceof Error ? usersQuery.error.message : null}
          updateErrorMessage={updateQuotaMutation.error instanceof Error ? updateQuotaMutation.error.message : null}
          canPrev={userCursorHistory.length > 0}
          canNext={Boolean(usersPage?.hasMore && usersPage.nextCursor)}
          onSearchInputChange={setUserSearchInput}
          onSearch={() => {
            setUserSearch(userSearchInput.trim());
            resetUserListState();
          }}
          onClearSearch={() => {
            setUserSearchInput('');
            setUserSearch('');
            resetUserListState();
          }}
          onPageSizeChange={(value) => {
            setPageSize(value);
            resetUserListState();
          }}
          onFreeLimitEditChange={(userId, value) => {
            setFreeLimitEdits((prev) => ({ ...prev, [userId]: value }));
          }}
          onPaidDeltaEditChange={(userId, value) => {
            setPaidDeltaEdits((prev) => ({ ...prev, [userId]: value }));
          }}
          onResetUserEdits={(userId) => {
            setFreeLimitEdits((prev) => clearEdit(prev, userId));
            setPaidDeltaEdits((prev) => clearEdit(prev, userId));
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
            setUserCursor(usersPage?.nextCursor ?? null);
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
  totalUsers: number;
  pageSize: number;
  currentPage: number;
  currentPageStart: number;
  currentPageEnd: number;
  currentPageAdminCount: number;
  currentPageUserCount: number;
  activeSearch: string;
  searchInput: string;
  freeLimitEdits: Record<string, string>;
  paidDeltaEdits: Record<string, string>;
  savingUserId: string | null;
  isLoading: boolean;
  listErrorMessage: string | null;
  updateErrorMessage: string | null;
  canPrev: boolean;
  canNext: boolean;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  onPageSizeChange: (value: number) => void;
  onFreeLimitEditChange: (userId: string, value: string) => void;
  onPaidDeltaEditChange: (userId: string, value: string) => void;
  onResetUserEdits: (userId: string) => void;
  onSaveUserQuota: (user: UserView) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}): JSX.Element {
  const resultLabel = props.activeSearch
    ? `检索 "${props.activeSearch}" 命中 ${props.totalUsers} 位用户`
    : `共 ${props.totalUsers} 位用户`;

  return (
    <AdminSurface className="space-y-4 p-5">
      <AdminToolbar className="flex flex-wrap justify-between gap-3">
        <form
          className="flex flex-1 flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSearch();
          }}
        >
          <Input
            className="min-w-[260px] flex-1"
            placeholder="按邮箱、用户名或用户 ID 搜索"
            value={props.searchInput}
            onChange={(event) => props.onSearchInputChange(event.target.value)}
          />
          <Button type="submit" variant="secondary">搜索</Button>
          <Button type="button" variant="ghost" onClick={props.onClearSearch}>清空</Button>
        </form>

        <label className="flex items-center gap-2 text-sm text-[#656561]">
          每页数量
          <select
            className="h-10 rounded-lg border border-[#d9d3c5] bg-white px-3 text-sm text-[#1f1f1d] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option} 条</option>
            ))}
          </select>
        </label>
      </AdminToolbar>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-[#f6f3ec] px-4 py-3 text-sm text-[#4d4a43]">
        <span>{resultLabel}</span>
        <span>第 {props.currentPage} 页</span>
        <span>当前展示 {props.currentPageStart}-{props.currentPageEnd}</span>
        <span>本页管理员 {props.currentPageAdminCount} 位</span>
        <span>本页普通用户 {props.currentPageUserCount} 位</span>
      </div>

      {props.isLoading ? <p className="text-sm text-[#8f8a7d]">加载用户中...</p> : null}
      {props.listErrorMessage ? <p className="text-sm text-rose-600">{props.listErrorMessage}</p> : null}

      <UserQuotaTable
        users={props.users}
        freeLimitEdits={props.freeLimitEdits}
        paidDeltaEdits={props.paidDeltaEdits}
        savingUserId={props.savingUserId}
        onFreeLimitEditChange={props.onFreeLimitEditChange}
        onPaidDeltaEditChange={props.onPaidDeltaEditChange}
        onResetUserEdits={props.onResetUserEdits}
        onSaveUserQuota={props.onSaveUserQuota}
      />

      {!props.isLoading && props.users.length === 0 ? (
        <p className="text-sm text-[#8f8a7d]">当前条件下没有用户记录。</p>
      ) : null}
      {props.updateErrorMessage ? <p className="text-sm text-rose-600">{props.updateErrorMessage}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#656561]">分页摘要：第 {props.currentPage} 页，每页 {props.pageSize} 条。</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-8 px-3" disabled={!props.canPrev} onClick={props.onPrevPage}>上一页</Button>
          <Button variant="secondary" className="h-8 px-3" disabled={!props.canNext} onClick={props.onNextPage}>下一页</Button>
        </div>
      </div>
    </AdminSurface>
  );
}

function UserQuotaTable(props: {
  users: UserView[];
  freeLimitEdits: Record<string, string>;
  paidDeltaEdits: Record<string, string>;
  savingUserId: string | null;
  onFreeLimitEditChange: (userId: string, value: string) => void;
  onPaidDeltaEditChange: (userId: string, value: string) => void;
  onResetUserEdits: (userId: string) => void;
  onSaveUserQuota: (user: UserView) => void;
}): JSX.Element {
  return (
    <TableWrap>
      <table className="min-w-[1240px] w-full text-left text-sm">
        <thead className="bg-[#f3f2ee] text-xs uppercase tracking-wide text-[#8f8a7d]">
          <tr>
            <th className="px-3 py-2">账号</th>
            <th className="px-3 py-2">角色</th>
            <th className="px-3 py-2">注册时间</th>
            <th className="px-3 py-2">最近更新</th>
            <th className="px-3 py-2">免费额度概览</th>
            <th className="px-3 py-2">付费余额</th>
            <th className="px-3 py-2">调整免费上限</th>
            <th className="px-3 py-2">余额增减</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {props.users.map((user) => {
            const freeLimitValue = props.freeLimitEdits[user.id] ?? String(user.freeLimitUsd);
            const paidDeltaValue = props.paidDeltaEdits[user.id] ?? '';
            const saveValidationMessage = getSaveValidationMessage(user, freeLimitValue, paidDeltaValue);
            const canSave = saveValidationMessage === null && hasEditableChange(user, freeLimitValue, paidDeltaValue);
            const isSaving = props.savingUserId === user.id;

            return (
              <tr key={user.id} className="border-t border-[#ece7dd] align-top">
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <p className="font-medium text-[#1f1f1d]">{user.email}</p>
                    <p className="text-xs text-[#656561]">用户名：{user.username ?? '未设置'}</p>
                    <p className="text-xs text-[#8f8a7d]">ID：{compactId(user.id)}</p>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={roleBadgeClassName(user.role)}>
                    {user.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="px-3 py-3 text-[#4d4a43]">{formatDateTime(user.createdAt)}</td>
                <td className="px-3 py-3 text-[#4d4a43]">{formatDateTime(user.updatedAt)}</td>
                <td className="px-3 py-3">
                  <div className="space-y-1 text-[#4d4a43]">
                    <p>上限：{formatUsd(user.freeLimitUsd)}</p>
                    <p>已用：{formatUsd(user.freeUsedUsd)}</p>
                    <p>剩余：{formatUsd(user.freeRemainingUsd)}</p>
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-[#1f1f1d]">{formatUsd(user.paidBalanceUsd)}</td>
                <td className="px-3 py-3">
                  <Input
                    className={inputClassName(saveValidationMessage !== null && !isValidFreeLimitInput(freeLimitValue))}
                    value={freeLimitValue}
                    onChange={(event) => props.onFreeLimitEditChange(user.id, event.target.value)}
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    className={inputClassName(saveValidationMessage !== null && !isValidPaidDeltaInput(paidDeltaValue))}
                    placeholder="如 10 / -5"
                    value={paidDeltaValue}
                    onChange={(event) => props.onPaidDeltaEditChange(user.id, event.target.value)}
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col items-start gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3"
                      disabled={!canSave || isSaving}
                      onClick={() => props.onSaveUserQuota(user)}
                    >
                      {isSaving ? '保存中...' : '保存'}
                    </Button>
                    <Button variant="ghost" className="h-8 px-3" onClick={() => props.onResetUserEdits(user.id)}>重置</Button>
                    {saveValidationMessage ? (
                      <p className="max-w-[180px] text-xs leading-5 text-rose-600">{saveValidationMessage}</p>
                    ) : !canSave ? (
                      <p className="text-xs text-[#8f8a7d]">未检测到有效改动</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
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

function hasEditableChange(user: UserView, freeLimitValue: string, paidDeltaValue: string): boolean {
  const freeLimitNumber = Number(freeLimitValue);
  const paidDeltaNumber = Number(paidDeltaValue || '0');
  const freeLimitChanged = Number.isFinite(freeLimitNumber) && freeLimitNumber >= 0 && freeLimitNumber !== user.freeLimitUsd;
  const paidDeltaChanged = Number.isFinite(paidDeltaNumber) && paidDeltaNumber !== 0;
  return freeLimitChanged || paidDeltaChanged;
}

function getSaveValidationMessage(user: UserView, freeLimitValue: string, paidDeltaValue: string): string | null {
  if (!isValidFreeLimitInput(freeLimitValue)) {
    return '免费上限必须是大于等于 0 的数字。';
  }
  if (!isValidPaidDeltaInput(paidDeltaValue)) {
    return '余额增减必须是数字，可留空表示不调整。';
  }
  if (!hasEditableChange(user, freeLimitValue, paidDeltaValue)) {
    return null;
  }
  return null;
}

function isValidFreeLimitInput(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isValidPaidDeltaInput(value: string): boolean {
  if (value.trim().length === 0) {
    return true;
  }
  return Number.isFinite(Number(value));
}

function inputClassName(hasError: boolean): string {
  return hasError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : '';
}

function roleBadgeClassName(role: UserView['role']): string {
  return role === 'admin'
    ? 'inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800'
    : 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700';
}
