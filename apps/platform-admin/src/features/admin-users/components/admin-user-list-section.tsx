import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserView } from '@/api/types';
import { fetchAdminUsers, updateAdminUser } from '@/features/admin-users/providers/admin-user-api.provider';
import type {
  AdminUserRoleFilter,
  AdminUserSortBy,
  AdminUserSortDirection,
} from '@/features/admin-users/types/admin-user.types';
import { AdminSection, AdminSurface } from '@/components/admin/admin-page';
import { AdminUserListToolbar } from '@/features/admin-users/components/admin-user-list-toolbar';
import { AdminUserPagination } from '@/features/admin-users/components/admin-user-pagination';
import { AdminUserQuotaDialog } from '@/features/admin-users/components/admin-user-quota-dialog';
import { AdminUserTable } from '@/features/admin-users/components/admin-user-table';

type Props = {
  token: string;
};

type UserListQuery = {
  q: string;
  role: AdminUserRoleFilter;
  page: number;
  pageSize: number;
  sortBy: AdminUserSortBy;
  sortDirection: AdminUserSortDirection;
};

type UpdateQuotaPayload = {
  userId: string;
  freeLimitUsd?: number;
  paidBalanceDeltaUsd?: number;
};

const DEFAULT_USER_LIST_QUERY: UserListQuery = {
  q: '',
  role: 'all',
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

const EMPTY_USER_COUNTS = { all: 0, admin: 0, user: 0 };

export function AdminUserListSection({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [listQuery, setListQuery] = useState<UserListQuery>(DEFAULT_USER_LIST_QUERY);
  const [editingUser, setEditingUser] = useState<UserView | null>(null);
  const [freeLimitDraft, setFreeLimitDraft] = useState('');
  const [paidBalanceDeltaDraft, setPaidBalanceDeltaDraft] = useState('');
  const usersQuery = useQuery({
    queryKey: ['admin-users', listQuery],
    queryFn: async () => await fetchAdminUsers(token, listQuery),
  });
  const updateQuotaMutation = useMutation({
    mutationFn: async (payload: UpdateQuotaPayload) => {
      await updateAdminUser(token, payload.userId, payload);
    },
    onSuccess: async () => {
      closeQuotaEditor();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] }),
      ]);
    },
  });
  const usersPage = usersQuery.data;
  const quotaValidationMessage = editingUser
    ? getQuotaValidationMessage(freeLimitDraft, paidBalanceDeltaDraft)
    : null;
  const canSaveQuota = editingUser
    ? quotaValidationMessage === null && hasQuotaChange(editingUser, freeLimitDraft, paidBalanceDeltaDraft)
    : false;

  function openQuotaEditor(user: UserView): void {
    updateQuotaMutation.reset();
    setEditingUser(user);
    setFreeLimitDraft(String(user.freeLimitUsd));
    setPaidBalanceDeltaDraft('');
  }

  function closeQuotaEditor(): void {
    setEditingUser(null);
    setFreeLimitDraft('');
    setPaidBalanceDeltaDraft('');
  }

  function changeSort(sortBy: AdminUserSortBy): void {
    setListQuery((current) => ({
      ...current,
      page: 1,
      sortBy,
      sortDirection: current.sortBy === sortBy
        ? (current.sortDirection === 'asc' ? 'desc' : 'asc')
        : defaultSortDirection(sortBy),
    }));
  }

  return (
    <AdminSection
      title="用户列表"
      description="浏览、筛选和排序保持轻量；额度修改只在明确选择用户后进入独立操作面板。"
    >
      <AdminSurface className="space-y-4 p-3 sm:p-5">
        <AdminUserListToolbar
          searchInput={searchInput}
          activeSearch={listQuery.q}
          role={listQuery.role}
          counts={usersPage?.counts ?? EMPTY_USER_COUNTS}
          isFetching={usersQuery.isFetching}
          onSearchInputChange={setSearchInput}
          onSearch={() => setListQuery((current) => ({ ...current, q: searchInput.trim(), page: 1 }))}
          onRoleChange={(role) => setListQuery((current) => ({ ...current, role, page: 1 }))}
          onReset={() => {
            setSearchInput('');
            setListQuery((current) => ({ ...current, q: '', role: 'all', page: 1 }));
          }}
          onRefresh={() => void usersQuery.refetch()}
        />

        {usersQuery.error ? (
          <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {usersQuery.error instanceof Error ? usersQuery.error.message : '用户列表加载失败。'}
          </p>
        ) : null}

        <AdminUserTable
          users={usersPage?.items ?? []}
          isLoading={usersQuery.isLoading}
          sortBy={listQuery.sortBy}
          sortDirection={listQuery.sortDirection}
          onSort={changeSort}
          onManageQuota={openQuotaEditor}
        />

        <AdminUserPagination
          page={usersPage?.page ?? listQuery.page}
          pageSize={listQuery.pageSize}
          total={usersPage?.total ?? 0}
          totalPages={usersPage?.totalPages ?? 0}
          onPageChange={(page) => setListQuery((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setListQuery((current) => ({ ...current, page: 1, pageSize }))}
        />
      </AdminSurface>

      {editingUser ? (
        <AdminUserQuotaDialog
          user={editingUser}
          freeLimitDraft={freeLimitDraft}
          paidBalanceDeltaDraft={paidBalanceDeltaDraft}
          validationMessage={quotaValidationMessage}
          mutationErrorMessage={updateQuotaMutation.error instanceof Error ? updateQuotaMutation.error.message : null}
          isSaving={updateQuotaMutation.isPending}
          canSave={canSaveQuota}
          onFreeLimitDraftChange={setFreeLimitDraft}
          onPaidBalanceDeltaDraftChange={setPaidBalanceDeltaDraft}
          onCancel={closeQuotaEditor}
          onSave={() => {
            if (canSaveQuota) {
              updateQuotaMutation.mutate(buildUpdateQuotaPayload(editingUser, freeLimitDraft, paidBalanceDeltaDraft));
            }
          }}
        />
      ) : null}
    </AdminSection>
  );
}

function buildUpdateQuotaPayload(
  user: UserView,
  freeLimitDraft: string,
  paidBalanceDeltaDraft: string,
): UpdateQuotaPayload {
  const freeLimitUsd = Number(freeLimitDraft);
  const paidBalanceDeltaUsd = Number(paidBalanceDeltaDraft || '0');
  return {
    userId: user.id,
    freeLimitUsd: freeLimitUsd === user.freeLimitUsd ? undefined : freeLimitUsd,
    paidBalanceDeltaUsd: paidBalanceDeltaUsd === 0 ? undefined : paidBalanceDeltaUsd,
  };
}

function getQuotaValidationMessage(freeLimitDraft: string, paidBalanceDeltaDraft: string): string | null {
  const freeLimitUsd = Number(freeLimitDraft);
  if (!Number.isFinite(freeLimitUsd) || freeLimitUsd < 0) {
    return '免费额度上限必须是大于等于 0 的数字。';
  }
  if (paidBalanceDeltaDraft.trim().length > 0 && !Number.isFinite(Number(paidBalanceDeltaDraft))) {
    return '付费余额增减必须是有效数字。';
  }
  return null;
}

function hasQuotaChange(user: UserView, freeLimitDraft: string, paidBalanceDeltaDraft: string): boolean {
  return Number(freeLimitDraft) !== user.freeLimitUsd || Number(paidBalanceDeltaDraft || '0') !== 0;
}

function defaultSortDirection(sortBy: AdminUserSortBy): AdminUserSortDirection {
  return sortBy === 'email' || sortBy === 'role' ? 'asc' : 'desc';
}
