import type {
  AdminUserListQuery,
  AdminUserListResult,
} from "@/types/admin-user.types";
import type { UserRow } from "@/types/platform";

const ADMIN_USER_SORT_COLUMNS = {
  email: "email COLLATE NOCASE",
  role: "role",
  freeLimitUsd: "free_limit_usd",
  freeUsedUsd: "free_used_usd",
  paidBalanceUsd: "paid_balance_usd",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

export async function listAdminUsers(
  db: D1Database,
  query: AdminUserListQuery,
): Promise<AdminUserListResult> {
  const searchConditions: string[] = [];
  const searchBindings: Array<string | number> = [];
  if (query.q) {
    const searchPattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
    searchConditions.push(`(
      email LIKE ? ESCAPE '\\'
      OR username LIKE ? ESCAPE '\\'
      OR id LIKE ? ESCAPE '\\'
    )`);
    searchBindings.push(searchPattern, searchPattern, searchPattern);
  }

  const listConditions = [...searchConditions];
  const listBindings = [...searchBindings];
  if (query.role !== "all") {
    listConditions.push("role = ?");
    listBindings.push(query.role);
  }

  const searchWhereSql = searchConditions.length > 0
    ? `WHERE ${searchConditions.join(" AND ")}`
    : "";
  const listWhereSql = listConditions.length > 0
    ? `WHERE ${listConditions.join(" AND ")}`
    : "";
  const orderColumn = ADMIN_USER_SORT_COLUMNS[query.sortBy];
  const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
  const offset = (query.page - 1) * query.pageSize;

  const [countRow, rows] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS all_count,
              SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_count,
              SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_count
         FROM users
         ${searchWhereSql}`,
    )
      .bind(...searchBindings)
      .first<{ all_count: number; admin_count: number; user_count: number }>(),
    db.prepare(
      `SELECT id, email, username, password_hash, password_salt, role,
              free_limit_usd, free_used_usd, paid_balance_usd,
              created_at, updated_at
         FROM users
         ${listWhereSql}
        ORDER BY ${orderColumn} ${orderDirection}, id ${orderDirection}
        LIMIT ? OFFSET ?`,
    )
      .bind(...listBindings, query.pageSize, offset)
      .all<UserRow>(),
  ]);

  const counts = {
    all: Number(countRow?.all_count ?? 0),
    admin: Number(countRow?.admin_count ?? 0),
    user: Number(countRow?.user_count ?? 0),
  };
  return {
    rows: rows.results ?? [],
    counts,
    total: query.role === "all" ? counts.all : counts[query.role],
  };
}
