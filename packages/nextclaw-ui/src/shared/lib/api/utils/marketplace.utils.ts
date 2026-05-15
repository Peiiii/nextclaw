import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type {
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceInstalledView,
  MarketplacePluginContentView,
  MarketplaceItemType,
  MarketplaceSkillContentView,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  MarketplaceScenesView,
  MarketplaceSort
} from '@/shared/lib/api/types';

export type MarketplaceListParams = {
  type: MarketplaceItemType;
  q?: string;
  tag?: string;
  scene?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export async function fetchMarketplaceItems(params: MarketplaceListParams): Promise<MarketplaceListView> {
  return await nextclawClient.marketplace.fetchItems(params);
}

export async function fetchMarketplaceItem(slug: string, type: MarketplaceItemType): Promise<MarketplaceItemView> {
  return await nextclawClient.marketplace.fetchItem(slug, type);
}

export async function fetchMarketplaceSkillContent(slug: string): Promise<MarketplaceSkillContentView> {
  return await nextclawClient.marketplace.fetchSkillContent(slug);
}

export async function fetchMarketplacePluginContent(slug: string): Promise<MarketplacePluginContentView> {
  return await nextclawClient.marketplace.fetchPluginContent(slug);
}

export async function fetchMarketplaceRecommendations(
  type: MarketplaceItemType,
  params: {
    scene?: string;
    limit?: number;
  } = {}
): Promise<MarketplaceRecommendationView> {
  return await nextclawClient.marketplace.fetchRecommendations(type, params);
}

export async function fetchMarketplaceSkillScenes(): Promise<MarketplaceScenesView> {
  return await nextclawClient.marketplace.fetchSkillScenes();
}

export async function installMarketplaceItem(request: MarketplaceInstallRequest): Promise<MarketplaceInstallResult> {
  return await nextclawClient.marketplace.install(
    request as Parameters<typeof nextclawClient.marketplace.install>[0]
  ) as MarketplaceInstallResult;
}

export async function fetchMarketplaceInstalled(type: MarketplaceItemType): Promise<MarketplaceInstalledView> {
  return await nextclawClient.marketplace.fetchInstalled(type);
}

export async function manageMarketplaceItem(request: MarketplaceManageRequest): Promise<MarketplaceManageResult> {
  return await nextclawClient.marketplace.manage(
    request as Parameters<typeof nextclawClient.marketplace.manage>[0]
  ) as MarketplaceManageResult;
}
