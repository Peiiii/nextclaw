import { request } from '@/api/client';
import type { RemoteQuotaSummary } from '@/features/dashboard/types/remote-quota.types';

type QuotaEnvelope =
  | { ok: true; data: RemoteQuotaSummary }
  | { ok: false; error: { code: string; message: string } };

export async function fetchRemoteQuotaSummary(token: string): Promise<RemoteQuotaSummary> {
  const payload = await request<QuotaEnvelope>('/platform/remote/quota/v2', {}, token);
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}
