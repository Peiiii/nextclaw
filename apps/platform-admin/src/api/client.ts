import type {
  AdminOverview,
  ApiEnvelope,
  ApiFailure,
  AuthResult,
  BillingOverview,
  CursorPage,
  LedgerItem,
  RechargeIntentItem,
  UserView
} from '@/api/types';

const rawApiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim();
const apiBase = rawApiBase.replace(/\/+$/, '');

function toApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!apiBase) {
    return path;
  }
  return path.startsWith('/') ? `${apiBase}${path}` : `${apiBase}/${path}`;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(toApiUrl(path), {
    ...options,
    headers
  });

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const body = parsed as ApiFailure | { error?: { message?: string } } | null;
    const fallback = `Request failed: ${response.status}`;
    if (body && 'ok' in body && body.ok === false && body.error?.message) {
      throw new Error(body.error.message);
    }
    if (body && 'error' in body && body.error?.message) {
      throw new Error(body.error.message);
    }
    throw new Error(fallback);
  }

  return parsed as T;
}

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return envelope.data;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const data = await request<ApiEnvelope<AuthResult>>('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  return unwrap(data);
}

export async function fetchMe(token: string): Promise<{ user: UserView }> {
  const data = await request<ApiEnvelope<{ user: UserView }>>('/platform/auth/me', {}, token);
  return unwrap(data);
}

export async function fetchBillingOverview(token: string): Promise<BillingOverview> {
  const data = await request<ApiEnvelope<BillingOverview>>('/platform/billing/overview', {}, token);
  return unwrap(data);
}

export async function fetchBillingLedger(token: string): Promise<CursorPage<LedgerItem>> {
  const data = await request<ApiEnvelope<CursorPage<LedgerItem>>>('/platform/billing/ledger?limit=50', {}, token);
  return unwrap(data);
}

export async function createRechargeIntent(token: string, amountUsd: number, note?: string): Promise<void> {
  await request<ApiEnvelope<{ id: string }>>('/platform/billing/recharge-intents', {
    method: 'POST',
    body: JSON.stringify({ amountUsd, note: note ?? '' })
  }, token);
}

export async function fetchRechargeIntents(token: string): Promise<CursorPage<RechargeIntentItem>> {
  const data = await request<ApiEnvelope<CursorPage<RechargeIntentItem>>>('/platform/billing/recharge-intents?limit=50', {}, token);
  return unwrap(data);
}

export async function fetchAdminOverview(token: string): Promise<AdminOverview> {
  const data = await request<ApiEnvelope<AdminOverview>>('/platform/admin/overview', {}, token);
  return unwrap(data);
}

export async function fetchAdminUsers(
  token: string,
  options: { limit?: number; q?: string; cursor?: string | null } = {}
): Promise<CursorPage<UserView>> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 20));
  if (options.q && options.q.trim().length > 0) {
    params.set('q', options.q.trim());
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  const data = await request<ApiEnvelope<CursorPage<UserView>>>(`/platform/admin/users?${params.toString()}`, {}, token);
  return unwrap(data);
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: { freeLimitUsd?: number; paidBalanceDeltaUsd?: number }
): Promise<{ changed: boolean; user: UserView }> {
  const data = await request<ApiEnvelope<{ changed: boolean; user: UserView }>>(`/platform/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }, token);
  return unwrap(data);
}

export async function fetchAdminRechargeIntents(
  token: string,
  options: { limit?: number; status?: 'pending' | 'confirmed' | 'rejected' | 'all'; cursor?: string | null } = {}
): Promise<CursorPage<RechargeIntentItem>> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 20));
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  const data = await request<ApiEnvelope<CursorPage<RechargeIntentItem>>>(`/platform/admin/recharge-intents?${params.toString()}`, {}, token);
  return unwrap(data);
}

export async function confirmRechargeIntent(token: string, intentId: string): Promise<void> {
  await request<ApiEnvelope<{ intentId: string }>>(`/platform/admin/recharge-intents/${encodeURIComponent(intentId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({})
  }, token);
}

export async function rejectRechargeIntent(token: string, intentId: string): Promise<void> {
  await request<ApiEnvelope<{ intentId: string }>>(`/platform/admin/recharge-intents/${encodeURIComponent(intentId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({})
  }, token);
}

export async function updateGlobalFreeLimit(token: string, globalFreeLimitUsd: number): Promise<void> {
  await request<ApiEnvelope<{ globalFreeLimitUsd: number }>>('/platform/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify({ globalFreeLimitUsd })
  }, token);
}
