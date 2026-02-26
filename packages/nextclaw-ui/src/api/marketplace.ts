import { api } from './client';
import type {
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceInstalledView,
  MarketplaceItemType,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  MarketplaceSort
} from './types';

export type MarketplaceListParams = {
  type: MarketplaceItemType;
  q?: string;
  tag?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

function toMarketplaceTypeSegment(type: MarketplaceItemType): 'plugins' | 'skills' {
  return type === 'plugin' ? 'plugins' : 'skills';
}

export async function fetchMarketplaceItems(params: MarketplaceListParams): Promise<MarketplaceListView> {
  const query = new URLSearchParams();
  const segment = toMarketplaceTypeSegment(params.type);

  if (params.q?.trim()) {
    query.set('q', params.q.trim());
  }
  if (params.tag?.trim()) {
    query.set('tag', params.tag.trim());
  }
  if (params.sort) {
    query.set('sort', params.sort);
  }
  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.set('page', String(Math.max(1, Math.trunc(params.page))));
  }
  if (typeof params.pageSize === 'number' && Number.isFinite(params.pageSize)) {
    query.set('pageSize', String(Math.max(1, Math.trunc(params.pageSize))));
  }

  const suffix = query.toString();
  const response = await api.get<MarketplaceListView>(
    suffix ? `/api/marketplace/${segment}/items?${suffix}` : `/api/marketplace/${segment}/items`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceItem(slug: string, type: MarketplaceItemType): Promise<MarketplaceItemView> {
  const segment = toMarketplaceTypeSegment(type);
  const response = await api.get<MarketplaceItemView>(
    `/api/marketplace/${segment}/items/${encodeURIComponent(slug)}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceRecommendations(
  type: MarketplaceItemType,
  params: {
    scene?: string;
    limit?: number;
  } = {}
): Promise<MarketplaceRecommendationView> {
  const query = new URLSearchParams();
  const segment = toMarketplaceTypeSegment(type);
  if (params.scene?.trim()) {
    query.set('scene', params.scene.trim());
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(1, Math.trunc(params.limit))));
  }

  const suffix = query.toString();
  const response = await api.get<MarketplaceRecommendationView>(
    suffix
      ? `/api/marketplace/${segment}/recommendations?${suffix}`
      : `/api/marketplace/${segment}/recommendations`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function installMarketplaceItem(request: MarketplaceInstallRequest): Promise<MarketplaceInstallResult> {
  const segment = toMarketplaceTypeSegment(request.type);
  const response = await api.post<MarketplaceInstallResult>(`/api/marketplace/${segment}/install`, request);
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceInstalled(type: MarketplaceItemType): Promise<MarketplaceInstalledView> {
  const segment = toMarketplaceTypeSegment(type);
  const response = await api.get<MarketplaceInstalledView>(`/api/marketplace/${segment}/installed`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function manageMarketplaceItem(request: MarketplaceManageRequest): Promise<MarketplaceManageResult> {
  const segment = toMarketplaceTypeSegment(request.type);
  const response = await api.post<MarketplaceManageResult>(`/api/marketplace/${segment}/manage`, request);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
