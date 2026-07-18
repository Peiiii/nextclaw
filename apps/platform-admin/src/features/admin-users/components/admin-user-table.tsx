import type {
  AdminUserSortBy,
  AdminUserSortDirection,
} from '@/features/admin-users/types/admin-user.types';
import type { UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/shared/components/data-table';
import { compactId, formatDateTime, formatUsd } from '@/lib/utils';

type Props = {
  users: UserView[];
  isLoading: boolean;
  sortBy: AdminUserSortBy;
  sortDirection: AdminUserSortDirection;
  onSort: (sortBy: AdminUserSortBy) => void;
  onManageQuota: (user: UserView) => void;
};

export function AdminUserTable(props: Props): JSX.Element {
  return (
    <DataTable
      columns={createAdminUserColumns(props)}
      items={props.users}
      rowKey={(user) => user.id}
      emptyContent="当前筛选条件下没有用户记录。"
      isLoading={props.isLoading}
      minWidth={1080}
      sortBy={props.sortBy}
      sortDirection={props.sortDirection}
      onSort={(columnKey) => props.onSort(columnKey as AdminUserSortBy)}
      renderMobileItem={(user) => <AdminUserMobileCard user={user} onManageQuota={props.onManageQuota} />}
    />
  );
}

function AdminUserMobileCard({ user, onManageQuota }: { user: UserView; onManageQuota: (user: UserView) => void }): JSX.Element {
  return (
    <article data-testid="admin-user-mobile-card" className="space-y-4 rounded-xl border border-[#e4e0d7] bg-white p-4 shadow-[0_1px_2px_rgba(31,31,29,0.04)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#1f1f1d]" title={user.email}>{user.email}</p>
          <p className="mt-1 truncate text-xs text-[#7b766b]">
            {user.username ? `@${user.username}` : '未设置用户名'} · <span className="font-mono" title={user.id}>{compactId(user.id)}</span>
          </p>
        </div>
        <span className={roleBadgeClassName(user.role)}>{roleLabel(user.role)}</span>
      </div>

      <QuotaUsageCell user={user} />

      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-[#f6f3ec] p-3 text-xs">
        <div>
          <dt className="text-[#7b766b]">付费余额</dt>
          <dd className="mt-1 font-semibold tabular-nums text-[#1f1f1d]">{formatUsd(user.paidBalanceUsd)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-[#7b766b]">注册时间</dt>
          <dd className="mt-1 font-medium text-[#1f1f1d]">{formatDateTime(user.createdAt)}</dd>
        </div>
        <div className="col-span-2 border-t border-[#e4e0d7] pt-2">
          <dt className="text-[#7b766b]">最近更新</dt>
          <dd className="mt-1 font-medium text-[#1f1f1d]">{formatDateTime(user.updatedAt)}</dd>
        </div>
      </dl>

      <Button variant="secondary" className="h-10 w-full" onClick={() => onManageQuota(user)}>
        管理额度
      </Button>
    </article>
  );
}

function createAdminUserColumns(props: Props): Array<DataTableColumn<UserView>> {
  return [
    {
      key: 'email',
      header: '账号',
      width: 280,
      minWidth: 260,
      sticky: 'left',
      sortable: true,
      render: (user) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#1f1f1d]" title={user.email}>{user.email}</p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#7b766b]">
            <span className="truncate">{user.username ? `@${user.username}` : '未设置用户名'}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0 font-mono" title={user.id}>{compactId(user.id)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: '角色',
      width: 120,
      sortable: true,
      render: (user) => <span className={roleBadgeClassName(user.role)}>{roleLabel(user.role)}</span>,
    },
    {
      key: 'freeUsedUsd',
      header: '免费额度',
      width: 240,
      minWidth: 220,
      sortable: true,
      render: (user) => <QuotaUsageCell user={user} />,
    },
    {
      key: 'paidBalanceUsd',
      header: '付费余额',
      width: 140,
      align: 'right',
      sortable: true,
      render: (user) => <span className="font-semibold tabular-nums text-[#1f1f1d]">{formatUsd(user.paidBalanceUsd)}</span>,
    },
    {
      key: 'createdAt',
      header: '注册时间',
      width: 170,
      sortable: true,
      render: (user) => <span className="whitespace-nowrap text-[#4d4a43]">{formatDateTime(user.createdAt)}</span>,
    },
    {
      key: 'updatedAt',
      header: '最近更新',
      width: 170,
      sortable: true,
      render: (user) => <span className="whitespace-nowrap text-[#4d4a43]">{formatDateTime(user.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      width: 132,
      align: 'right',
      sticky: 'right',
      render: (user) => (
        <Button
          variant="secondary"
          className="h-8 whitespace-nowrap px-3"
          onClick={() => props.onManageQuota(user)}
        >
          管理额度
        </Button>
      ),
    },
  ];
}

function QuotaUsageCell({ user }: { user: UserView }): JSX.Element {
  const utilization = user.freeLimitUsd > 0
    ? Math.min(100, Math.max(0, user.freeUsedUsd / user.freeLimitUsd * 100))
    : 0;
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium tabular-nums text-[#1f1f1d]">
          {formatUsd(user.freeUsedUsd)} / {formatUsd(user.freeLimitUsd)}
        </span>
        <span className="shrink-0 tabular-nums text-[#7b766b]">余 {formatUsd(user.freeRemainingUsd)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#ece8df]" aria-label={`免费额度使用率 ${utilization.toFixed(0)}%`}>
        <div
          className={utilization >= 90 ? 'h-full rounded-full bg-rose-500' : 'h-full rounded-full bg-brand-500'}
          style={{ width: `${utilization}%` }}
        />
      </div>
    </div>
  );
}

function roleLabel(role: UserView['role']): string {
  return role === 'admin' ? '管理员' : '普通用户';
}

function roleBadgeClassName(role: UserView['role']): string {
  return role === 'admin'
    ? 'inline-flex shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800'
    : 'inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700';
}
