import type {
  AdminDistributionAdoptionOverview,
  AdminDistributionAssetListQuery
} from '@/features/admin-overview/types/distribution-adoption.types';

type OverviewEnvelope =
  | { ok: true; data: AdminDistributionAdoptionOverview }
  | { ok: false; error: { message: string } };

type RefreshEnvelope =
  | { ok: true; data: { overview: AdminDistributionAdoptionOverview } }
  | { ok: false; error: { message: string } };

const apiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim().replace(/\/+$/, '');

export class AdminDistributionAdoptionApiService {
  constructor(private readonly token: string) {}

  fetchOverview = async (query: AdminDistributionAssetListQuery): Promise<AdminDistributionAdoptionOverview> => {
    const search = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize)
    });
    if (query.query) search.set('q', query.query);
    if (query.artifactKind) search.set('artifactKind', query.artifactKind);
    if (query.platform) search.set('platform', query.platform);
    const response = await fetch(`${apiBase}/platform/admin/distribution/overview?${search.toString()}`, {
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
