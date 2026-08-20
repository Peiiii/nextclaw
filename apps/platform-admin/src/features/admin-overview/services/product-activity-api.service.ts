import type {
  AdminProductActivityOverview,
  ProductActivityAudience
} from '@/features/admin-overview/types/product-activity.types';

type ProductActivityEnvelope =
  | { ok: true; data: AdminProductActivityOverview }
  | { ok: false; error: { message: string } };

const apiBase = (import.meta.env.VITE_PLATFORM_API_BASE ?? '').trim().replace(/\/+$/, '');

export class AdminProductActivityApiService {
  constructor(private readonly token: string) {}

  fetchOverview = async (audience: ProductActivityAudience): Promise<AdminProductActivityOverview> => {
    const query = new URLSearchParams({
      audience,
      environment: 'production',
      releaseChannel: 'stable',
      days: '30'
    });
    const response = await fetch(`${apiBase}/platform/admin/analytics/activity?${query.toString()}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    const payload = await response.json() as ProductActivityEnvelope;
    if (!response.ok || !payload.ok) {
      const message = payload.ok ? `Request failed: ${response.status}` : payload.error.message;
      throw new Error(message);
    }
    return payload.data;
  };
}
