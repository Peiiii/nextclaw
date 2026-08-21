import type { AdminDistributionAdoptionOverview } from '@/features/admin-overview/types/distribution-adoption.types';

type OverviewEnvelope =
  | { ok: true; data: AdminDistributionAdoptionOverview }
  | { ok: false; error: { message: string } };

type RefreshEnvelope =
  | { ok: true; data: { overview: AdminDistributionAdoptionOverview } }
  | { ok: false; error: { message: string } };

const apiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim().replace(/\/+$/, '');

export class AdminDistributionAdoptionApiService {
  constructor(private readonly token: string) {}

  fetchOverview = async (): Promise<AdminDistributionAdoptionOverview> => {
    const response = await fetch(`${apiBase}/platform/admin/distribution/overview`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const payload = await response.json() as OverviewEnvelope;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? `Request failed: ${response.status}` : payload.error.message);
    }
    return payload.data;
  };

  refresh = async (): Promise<AdminDistributionAdoptionOverview> => {
    const response = await fetch(`${apiBase}/platform/admin/distribution/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const payload = await response.json() as RefreshEnvelope;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? `Request failed: ${response.status}` : payload.error.message);
    }
    return payload.data.overview;
  };
}
