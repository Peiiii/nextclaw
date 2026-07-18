import type { Role, UserView } from '@/api/types';

export type AdminUserRoleFilter = Role | 'all';
export type AdminUserSortBy =
  | 'email'
  | 'role'
  | 'freeLimitUsd'
  | 'freeUsedUsd'
  | 'paidBalanceUsd'
  | 'createdAt'
  | 'updatedAt';
export type AdminUserSortDirection = 'asc' | 'desc';

export type AdminUsersPage = {
  items: UserView[];
  counts: {
    all: number;
    admin: number;
    user: number;
  };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  role: AdminUserRoleFilter;
  sortBy: AdminUserSortBy;
  sortDirection: AdminUserSortDirection;
  nextCursor: string | null;
  hasMore: boolean;
};
