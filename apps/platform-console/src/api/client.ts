import type {
  AdminOverview,
  ApiEnvelope,
  ApiFailure,
  AuthResult,
  BillingOverview,
  CursorPage,
  EmailCodeSendResult,
  LedgerItem,
  AdminRemoteQuotaSummary,
  RechargeIntentItem,
  RemoteAccessSession,
  RemoteInstance,
  RemoteQuotaSummary,
  RemoteShareGrant,
  UpdateProfileInput,
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

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function normalizeDevelopmentHostedUrl(url: string): string {
  if (typeof window === 'undefined') {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!isLoopbackHostname(window.location.hostname) || !isLoopbackHostname(parsed.hostname)) {
      return url;
    }
    parsed.protocol = window.location.protocol;
    parsed.host = window.location.host;
    return parsed.toString();
  } catch {
    return url;
  }
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

export async function sendRegisterCode(email: string): Promise<EmailCodeSendResult> {
  const data = await request<ApiEnvelope<EmailCodeSendResult>>('/platform/auth/register/send-code', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  return unwrap(data);
}

export async function completeRegister(email: string, code: string, password: string): Promise<AuthResult> {
  const data = await request<ApiEnvelope<AuthResult>>('/platform/auth/register/complete', {
    method: 'POST',
    body: JSON.stringify({ email, code, password })
  });
  return unwrap(data);
}

export async function sendPasswordResetCode(email: string): Promise<EmailCodeSendResult> {
  const data = await request<ApiEnvelope<EmailCodeSendResult>>('/platform/auth/password/reset/send-code', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  return unwrap(data);
}

export async function completePasswordReset(email: string, code: string, password: string): Promise<AuthResult> {
  const data = await request<ApiEnvelope<AuthResult>>('/platform/auth/password/reset/complete', {
    method: 'POST',
    body: JSON.stringify({ email, code, password })
  });
  return unwrap(data);
}

export async function fetchMe(token: string): Promise<{ user: UserView }> {
  const data = await request<ApiEnvelope<{ user: UserView }>>('/platform/auth/me', {}, token);
  return unwrap(data);
}

export async function updateProfile(token: string, input: UpdateProfileInput): Promise<AuthResult> {
  const data = await request<ApiEnvelope<AuthResult>>('/platform/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input)
  }, token);
  return unwrap(data);
}

export async function fetchBillingOverview(token: string): Promise<BillingOverview> {
  const data = await request<ApiEnvelope<BillingOverview>>('/platform/billing/overview', {}, token);
  return unwrap(data);
}

export async function fetchRemoteInstances(
  token: string,
  options: { includeArchived?: boolean } = {}
): Promise<{ items: RemoteInstance[] }> {
  const query = options.includeArchived ? '?includeArchived=true' : '';
  const data = await request<ApiEnvelope<{ items: RemoteInstance[] }>>(`/platform/remote/instances${query}`, {}, token);
  return unwrap(data);
}

export async function fetchRemoteQuotaSummary(token: string): Promise<RemoteQuotaSummary> {
  const data = await request<ApiEnvelope<RemoteQuotaSummary>>('/platform/remote/quota', {}, token);
  return unwrap(data);
}

export async function openRemoteInstance(token: string, instanceId: string): Promise<RemoteAccessSession> {
  const data = await request<ApiEnvelope<RemoteAccessSession>>(`/platform/remote/instances/${encodeURIComponent(instanceId)}/open`, {
    method: 'POST',
    body: JSON.stringify({})
  }, token);
  const session = unwrap(data);
  return {
    ...session,
    openUrl: normalizeDevelopmentHostedUrl(session.openUrl),
    fixedDomainOpenUrl: session.fixedDomainOpenUrl
      ? normalizeDevelopmentHostedUrl(session.fixedDomainOpenUrl)
      : null
  };
}

export async function fetchRemoteShareGrants(token: string, instanceId: string): Promise<{ items: RemoteShareGrant[] }> {
  const data = await request<ApiEnvelope<{ items: RemoteShareGrant[] }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/shares`,
    {},
    token
  );
  const result = unwrap(data);
  return {
    items: result.items.map((grant) => ({
      ...grant,
      shareUrl: normalizeDevelopmentHostedUrl(grant.shareUrl)
    }))
  };
}

export async function createRemoteShareGrant(
  token: string,
  instanceId: string,
  ttlSeconds?: number
): Promise<RemoteShareGrant> {
  const data = await request<ApiEnvelope<RemoteShareGrant>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/shares`,
    {
      method: 'POST',
      body: JSON.stringify(typeof ttlSeconds === 'number' ? { ttlSeconds } : {})
    },
    token
  );
  const grant = unwrap(data);
  return {
    ...grant,
    shareUrl: normalizeDevelopmentHostedUrl(grant.shareUrl)
  };
}

export async function archiveRemoteInstance(token: string, instanceId: string): Promise<RemoteInstance> {
  const data = await request<ApiEnvelope<{ instance: RemoteInstance }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/archive`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    token
  );
  return unwrap(data).instance;
}

export async function unarchiveRemoteInstance(token: string, instanceId: string): Promise<RemoteInstance> {
  const data = await request<ApiEnvelope<{ instance: RemoteInstance }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/unarchive`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    token
  );
  return unwrap(data).instance;
}

export async function deleteRemoteInstance(token: string, instanceId: string): Promise<{ deleted: boolean; instanceId: string }> {
  const data = await request<ApiEnvelope<{ deleted: boolean; instanceId: string }>>(
    `/platform/remote/instances/${encodeURIComponent(instanceId)}/delete`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    token
  );
  return unwrap(data);
}

export async function openRemoteShare(grantToken: string): Promise<RemoteAccessSession> {
  const data = await request<ApiEnvelope<RemoteAccessSession>>(
    `/platform/share/${encodeURIComponent(grantToken)}/open`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
  const session = unwrap(data);
  return {
    ...session,
    openUrl: normalizeDevelopmentHostedUrl(session.openUrl),
    fixedDomainOpenUrl: session.fixedDomainOpenUrl
      ? normalizeDevelopmentHostedUrl(session.fixedDomainOpenUrl)
      : null
  };
}

export async function revokeRemoteShareGrant(token: string, grantId: string): Promise<{ revoked: boolean; grantId: string; revokedAt: string }> {
  const data = await request<ApiEnvelope<{ revoked: boolean; grantId: string; revokedAt: string }>>(
    `/platform/remote/shares/${encodeURIComponent(grantId)}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify({})
    },
    token
  );
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

export async function fetchAdminRemoteQuotaSummary(token: string): Promise<AdminRemoteQuotaSummary> {
  const data = await request<ApiEnvelope<AdminRemoteQuotaSummary>>('/platform/admin/remote/quota', {}, token);
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
