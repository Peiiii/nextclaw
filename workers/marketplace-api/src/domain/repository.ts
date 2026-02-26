import type {
  MarketplaceCatalogSnapshot,
  MarketplaceItem,
  MarketplaceItemType,
  MarketplaceListQuery,
  MarketplaceListResult,
  MarketplaceRecommendationResult
} from "./model";

export type MarketplaceDataSource = {
  loadSnapshot(): Promise<MarketplaceCatalogSnapshot>;
};

export interface MarketplaceRepository {
  listItems(type: MarketplaceItemType, query: MarketplaceListQuery): Promise<MarketplaceListResult>;
  getItemBySlug(type: MarketplaceItemType, slug: string): Promise<MarketplaceItem | null>;
  listRecommendations(type: MarketplaceItemType, sceneId: string | undefined, limit: number): Promise<MarketplaceRecommendationResult>;
}
