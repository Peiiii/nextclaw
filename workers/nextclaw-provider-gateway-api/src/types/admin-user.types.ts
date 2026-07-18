import type { UserRole, UserRow } from "@/types/platform";

export type AdminUserRoleFilter = UserRole | "all";
export type AdminUserSortBy =
  | "email"
  | "role"
  | "freeLimitUsd"
  | "freeUsedUsd"
  | "paidBalanceUsd"
  | "createdAt"
  | "updatedAt";
export type AdminUserSortDirection = "asc" | "desc";

export type AdminUserListQuery = {
  q: string;
  role: AdminUserRoleFilter;
  page: number;
  pageSize: number;
  sortBy: AdminUserSortBy;
  sortDirection: AdminUserSortDirection;
};

export type AdminUserRoleCounts = {
  all: number;
  admin: number;
  user: number;
};

export type AdminUserListResult = {
  rows: UserRow[];
  counts: AdminUserRoleCounts;
  total: number;
};
