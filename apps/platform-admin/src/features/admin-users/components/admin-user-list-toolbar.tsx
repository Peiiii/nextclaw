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
    <div className="space-y-2 rounded-xl border border-[#e4e0d7] bg-white p-2.5 md:space-y-3 md:bg-[#faf9f6] md:p-3">
      <form className="flex min-w-0 gap-2" onSubmit={handleSearch}>
          <Input
            className="min-w-0 flex-1 md:max-w-xl md:min-w-[240px]"
            placeholder="搜索邮箱、用户名或用户 ID"
            value={props.searchInput}
            onChange={(event) => props.onSearchInputChange(event.target.value)}
          />
          <Button type="submit" variant="secondary" className="shrink-0 px-3">搜索</Button>
          {hasActiveFilters ? <Button type="button" variant="ghost" className="shrink-0 px-2 md:px-3" onClick={props.onReset}>重置</Button> : null}
      </form>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5" aria-label="用户角色筛选">
          {ROLE_FILTERS.map((filter) => {
            const isActive = props.role === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={isActive}
                className={cn(
                  'inline-flex h-8 min-w-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors md:gap-2 md:px-3 md:text-sm',
                  isActive
                    ? 'border-[#1f1f1d] bg-[#1f1f1d] text-white'
                    : 'border-[#ddd8cd] bg-white text-[#656561] hover:border-[#aaa394] hover:text-[#1f1f1d]',
                )}
                onClick={() => props.onRoleChange(filter.value)}
              >
                <span className="truncate">{filter.label}</span>
                <span className={cn('shrink-0 text-[10px] tabular-nums md:text-xs', isActive ? 'text-white/70' : 'text-[#9b9588]')}>
                  {props.counts[filter.value]}
                </span>
              </button>
            );
          })}
        </div>
        <Button type="button" variant="ghost" className="h-8 shrink-0 px-2 text-xs md:px-3" onClick={props.onRefresh}>
          {props.isFetching ? '刷新中' : '刷新'}
        </Button>
      </div>
    </div>
  );
}
