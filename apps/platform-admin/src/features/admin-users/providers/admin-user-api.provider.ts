import type { ApiEnvelope, ApiFailure, UserView } from '@/api/types';
import type {
  AdminUserRoleFilter,
  AdminUserSortBy,
  AdminUserSortDirection,
  AdminUsersPage,
} from '@/features/admin-users/types/admin-user.types';

type AdminUserListOptions = {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: AdminUserRoleFilter;
  sortBy?: AdminUserSortBy;
  sortDirection?: AdminUserSortDirection;
};

const rawApiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim();
const apiBase = rawApiBase.replace(/\/+$/, '');

export async function fetchAdminUsers(
  token: string,
  options: AdminUserListOptions = {},
): Promise<AdminUsersPage> {
  const params = new URLSearchParams();
  params.set('page', String(options.page ?? 1));
  params.set('pageSize', String(options.pageSize ?? 20));
  params.set('role', options.role ?? 'all');
  params.set('sortBy', options.sortBy ?? 'createdAt');
  params.set('sortDirection', options.sortDirection ?? 'desc');
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  const data = await requestAdminUserApi<AdminUsersPage>(
    `/platform/admin/users?${params.toString()}`,
    token,
  );
  return data;
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: { freeLimitUsd?: number; paidBalanceDeltaUsd?: number },
): Promise<{ changed: boolean; user: UserView }> {
  return await requestAdminUserApi<{ changed: boolean; user: UserView }>(
    `/platform/admin/users/${encodeURIComponent(userId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

async function requestAdminUserApi<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(toApiUrl(path), { ...options, headers });
  const parsed = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(readApiErrorMessage(parsed, response.status));
  }
  return (parsed as ApiEnvelope<T>).data;
}

function toApiUrl(path: string): string {
  if (!apiBase) {
    return path;
  }
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readApiErrorMessage(parsed: unknown, status: number): string {
  const body = parsed as ApiFailure | { error?: { message?: string } } | null;
  return body?.error?.message ?? `Request failed: ${status}`;
}
