export const MARKETPLACE_ITEM_TYPES = ["plugin", "skill"] as const;

export type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number];

export type MarketplaceSort = "relevance" | "updated";

export type MarketplaceInstallKind = "npm" | "clawhub" | "git" | "builtin";

export type MarketplaceInstallSpec = {
  kind: MarketplaceInstallKind;
  spec: string;
  command: string;
};

export type MarketplaceItem = {
  id: string;
  slug: string;
  type: MarketplaceItemType;
  name: string;
  summary: string;
  description?: string;
  tags: string[];
  author: string;
  sourceRepo?: string;
  homepage?: string;
  install: MarketplaceInstallSpec;
  publishedAt: string;
  updatedAt: string;
};

export type MarketplaceRecommendationScene = {
  id: string;
  title: string;
  description?: string;
  itemIds: string[];
};

export type MarketplaceCatalogSection = {
  items: MarketplaceItem[];
  recommendations: MarketplaceRecommendationScene[];
};

export type MarketplaceCatalogSnapshot = {
  version: string;
  generatedAt: string;
  plugins: MarketplaceCatalogSection;
  skills: MarketplaceCatalogSection;
};

export type MarketplaceListQuery = {
  q?: string;
  tag?: string;
  page: number;
  pageSize: number;
  sort: MarketplaceSort;
};

export type MarketplaceItemSummary = {
  id: string;
  slug: string;
  type: MarketplaceItemType;
  name: string;
  summary: string;
  tags: string[];
  author: string;
  install: MarketplaceInstallSpec;
  updatedAt: string;
};

export type MarketplaceListResult = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: MarketplaceSort;
  query?: string;
  items: MarketplaceItemSummary[];
};

export type MarketplaceRecommendationResult = {
  type: MarketplaceItemType;
  sceneId: string;
  title: string;
  description?: string;
  total: number;
  items: MarketplaceItemSummary[];
};
