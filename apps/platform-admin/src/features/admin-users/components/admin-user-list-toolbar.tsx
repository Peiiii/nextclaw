import type { FormEvent } from 'react';
import type { AdminUserRoleFilter, AdminUsersPage } from '@/features/admin-users/types/admin-user.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  searchInput: string;
  activeSearch: string;
  role: AdminUserRoleFilter;
  counts: AdminUsersPage['counts'];
  isFetching: boolean;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onRoleChange: (role: AdminUserRoleFilter) => void;
  onReset: () => void;
  onRefresh: () => void;
};

const ROLE_FILTERS: Array<{ value: AdminUserRoleFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
];

export function AdminUserListToolbar(props: Props): JSX.Element {
  const hasActiveFilters = Boolean(props.activeSearch) || props.role !== 'all';

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    props.onSearch();
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#e4e0d7] bg-[#faf9f6] p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap" onSubmit={handleSearch}>
          <Input
            className="col-span-2 min-w-0 max-w-xl flex-1 sm:col-span-1 sm:min-w-[240px]"
            placeholder="搜索邮箱、用户名或用户 ID"
            value={props.searchInput}
            onChange={(event) => props.onSearchInputChange(event.target.value)}
          />
          <Button type="submit" variant="secondary">搜索</Button>
          <Button type="button" variant="ghost" disabled={!hasActiveFilters} onClick={props.onReset}>重置</Button>
        </form>
        <Button type="button" variant="ghost" className="w-full self-start sm:w-auto xl:self-auto" onClick={props.onRefresh}>
          {props.isFetching ? '刷新中...' : '刷新'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="用户角色筛选">
        {ROLE_FILTERS.map((filter) => {
          const isActive = props.role === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-[#1f1f1d] bg-[#1f1f1d] text-white'
                  : 'border-[#ddd8cd] bg-white text-[#656561] hover:border-[#aaa394] hover:text-[#1f1f1d]',
              )}
              onClick={() => props.onRoleChange(filter.value)}
            >
              <span>{filter.label}</span>
              <span className={cn('text-xs tabular-nums', isActive ? 'text-white/70' : 'text-[#9b9588]')}>
                {props.counts[filter.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
