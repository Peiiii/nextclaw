import { nextclawClient } from '../managers/client.manager';
import type {
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceMcpContentView,
  MarketplaceMcpDoctorResult,
  MarketplaceRecommendationView,
  MarketplaceSort
} from '@/shared/lib/api/types';

export type McpMarketplaceListParams = {
  q?: string;
  tag?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export async function fetchMcpMarketplaceItems(params: McpMarketplaceListParams): Promise<MarketplaceListView> {
  return await nextclawClient.mcpMarketplace.fetchItems(params);
}

export async function fetchMcpMarketplaceInstalled(): Promise<MarketplaceInstalledView> {
  return await nextclawClient.mcpMarketplace.fetchInstalled();
}

export async function fetchMcpMarketplaceItem(slug: string): Promise<MarketplaceItemView> {
  return await nextclawClient.mcpMarketplace.fetchItem(slug);
}

export async function fetchMcpMarketplaceContent(slug: string): Promise<MarketplaceMcpContentView> {
  return await nextclawClient.mcpMarketplace.fetchContent(slug);
}

export async function fetchMcpMarketplaceRecommendations(params: {
  scene?: string;
  limit?: number;
} = {}): Promise<MarketplaceRecommendationView> {
  return await nextclawClient.mcpMarketplace.fetchRecommendations(params);
}

export async function installMcpMarketplaceItem(request: {
  spec: string;
  name?: string;
  enabled?: boolean;
  allAgents?: boolean;
  agents?: string[];
  inputs?: Record<string, string>;
}): Promise<{ type: 'mcp'; spec: string; name?: string; message: string; output?: string }> {
  return await nextclawClient.mcpMarketplace.install({
    type: 'mcp',
    ...request
  });
}

export async function manageMcpMarketplaceItem(request: {
  action: 'enable' | 'disable' | 'remove';
  id?: string;
  spec?: string;
}): Promise<{ type: 'mcp'; action: 'enable' | 'disable' | 'remove'; id: string; message: string; output?: string }> {
  return await nextclawClient.mcpMarketplace.manage({
    type: 'mcp',
    ...request
  });
}

export async function doctorMcpMarketplaceItem(name: string): Promise<MarketplaceMcpDoctorResult> {
  return await nextclawClient.mcpMarketplace.doctor(name);
}
