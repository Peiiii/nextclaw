import { api } from './client';
import type {
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceMcpContentView,
  MarketplaceMcpDoctorResult,
  MarketplaceRecommendationView,
  MarketplaceSort
} from './types';

export type McpMarketplaceListParams = {
  q?: string;
  tag?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export async function fetchMcpMarketplaceItems(params: McpMarketplaceListParams): Promise<MarketplaceListView> {
  const query = new URLSearchParams();
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
    suffix ? `/api/marketplace/mcp/items?${suffix}` : '/api/marketplace/mcp/items'
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchMcpMarketplaceInstalled(): Promise<MarketplaceInstalledView> {
  const response = await api.get<MarketplaceInstalledView>('/api/marketplace/mcp/installed');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchMcpMarketplaceItem(slug: string): Promise<MarketplaceItemView> {
  const response = await api.get<MarketplaceItemView>(`/api/marketplace/mcp/items/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchMcpMarketplaceContent(slug: string): Promise<MarketplaceMcpContentView> {
  const response = await api.get<MarketplaceMcpContentView>(`/api/marketplace/mcp/items/${encodeURIComponent(slug)}/content`);
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchMcpMarketplaceRecommendations(params: {
  scene?: string;
  limit?: number;
} = {}): Promise<MarketplaceRecommendationView> {
  const query = new URLSearchParams();
  if (params.scene?.trim()) {
    query.set('scene', params.scene.trim());
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(1, Math.trunc(params.limit))));
  }
  const suffix = query.toString();
  const response = await api.get<MarketplaceRecommendationView>(
    suffix ? `/api/marketplace/mcp/recommendations?${suffix}` : '/api/marketplace/mcp/recommendations'
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function installMcpMarketplaceItem(request: {
  spec: string;
  name?: string;
  enabled?: boolean;
  allAgents?: boolean;
  agents?: string[];
  inputs?: Record<string, string>;
}): Promise<{ type: 'mcp'; spec: string; name?: string; message: string; output?: string }> {
  const response = await api.post<{ type: 'mcp'; spec: string; name?: string; message: string; output?: string }>(
    '/api/marketplace/mcp/install',
    {
    type: 'mcp',
    ...request
    }
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function manageMcpMarketplaceItem(request: {
  action: 'enable' | 'disable' | 'remove';
  id?: string;
  spec?: string;
}): Promise<{ type: 'mcp'; action: 'enable' | 'disable' | 'remove'; id: string; message: string; output?: string }> {
  const response = await api.post<{ type: 'mcp'; action: 'enable' | 'disable' | 'remove'; id: string; message: string; output?: string }>(
    '/api/marketplace/mcp/manage',
    {
    type: 'mcp',
    ...request
    }
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function doctorMcpMarketplaceItem(name: string): Promise<MarketplaceMcpDoctorResult> {
  const response = await api.post<MarketplaceMcpDoctorResult>('/api/marketplace/mcp/doctor', { name });
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
