import type { AdminRemoteQuotaSummary } from '@/features/admin-overview/types/remote-quota.types';

type QuotaEnvelope =
  | { ok: true; data: AdminRemoteQuotaSummary }
  | { ok: false; error: { message: string } };

const apiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim().replace(/\/+$/, '');

export class AdminRemoteQuotaApiService {
  constructor(private readonly token: string) {}

  fetchSummary = async (): Promise<AdminRemoteQuotaSummary> => {
    const response = await fetch(`${apiBase}/platform/admin/remote/quota/v2`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const payload = await response.json() as QuotaEnvelope;
    if (!response.ok || !payload.ok) {
      const message = payload.ok ? `Request failed: ${response.status}` : payload.error.message;
      throw new Error(message);
    }
    return payload.data;
  };
}
