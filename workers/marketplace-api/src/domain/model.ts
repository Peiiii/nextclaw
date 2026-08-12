export const MARKETPLACE_ITEM_TYPES = ["plugin", "skill", "mcp"] as const;

export type MarketplaceItemType = (typeof MARKETPLACE_ITEM_TYPES)[number];

export type MarketplaceSort = "relevance" | "updated";

export type MarketplacePluginInstallKind = "npm";
export type MarketplaceSkillInstallKind = "builtin" | "marketplace";
export type MarketplaceMcpInstallKind = "template";
export type MarketplaceInstallKind = MarketplacePluginInstallKind | MarketplaceSkillInstallKind | MarketplaceMcpInstallKind;

export type MarketplacePluginInstallSpec = {
  kind: MarketplacePluginInstallKind;
  spec: string;
  command: string;
};

export type MarketplaceSkillInstallSpec = {
  kind: MarketplaceSkillInstallKind;
  spec: string;
  command: string;
};

export type MarketplaceMcpInputField = {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  defaultValue?: string;
};

export type MarketplaceMcpInstallSpec = {
  kind: MarketplaceMcpInstallKind;
  spec: string;
  command: string;
  defaultName: string;
  transportTypes: Array<"stdio" | "http" | "sse">;
  template: Record<string, unknown>;
  inputs: MarketplaceMcpInputField[];
};

export type MarketplaceInstallSpec =
  | MarketplacePluginInstallSpec
  | MarketplaceSkillInstallSpec
  | MarketplaceMcpInstallSpec;

export type LocalizedTextMap = Record<string, string>;

type MarketplaceItemBase = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  summaryI18n: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  tags: string[];
  author: string;
  sourceRepo?: string;
  homepage?: string;
  publishedAt: string;
  updatedAt: string;
};

export type MarketplacePluginItem = MarketplaceItemBase & {
  type: "plugin";
  install: MarketplacePluginInstallSpec;
};

export type MarketplaceSkillItem = MarketplaceItemBase & {
  type: "skill";
  packageName: string;
  ownerScope: string;
  skillName: string;
  publishStatus: "pending" | "published" | "rejected";
  publishedByType: "admin" | "user";
  install: MarketplaceSkillInstallSpec;
};

export type MarketplaceMcpItem = MarketplaceItemBase & {
  type: "mcp";
  vendor?: string;
  docsUrl?: string;
  iconUrl?: string;
  transportTypes: Array<"stdio" | "http" | "sse">;
  trust: {
    level: "official" | "verified" | "community";
    notes?: string;
  };
  install: MarketplaceMcpInstallSpec;
  contentMarkdown: string;
  contentSourceUrl?: string;
};

export type MarketplaceItem = MarketplacePluginItem | MarketplaceSkillItem | MarketplaceMcpItem;

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

export type MarketplaceListQuery = {
  q?: string;
  tag?: string;
  page: number;
  pageSize: number;
  sort: MarketplaceSort;
};

export type MarketplaceAppCatalogSort = "relevance" | "featured" | "updated";

export type MarketplaceAppCatalogQuery = {
  q?: string;
  tag?: string;
  tags?: string[];
  publisher?: string;
  featured?: boolean;
  cursor?: string;
  limit: number;
  sort: MarketplaceAppCatalogSort;
};

type MarketplaceItemSummaryBase = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  summaryI18n: LocalizedTextMap;
  tags: string[];
  author: string;
  updatedAt: string;
};

export type MarketplacePluginItemSummary = MarketplaceItemSummaryBase & {
  type: "plugin";
  install: MarketplacePluginInstallSpec;
};

export type MarketplaceSkillItemSummary = MarketplaceItemSummaryBase & {
  type: "skill";
  packageName: string;
  ownerScope: string;
  skillName: string;
  publishStatus: "pending" | "published" | "rejected";
  publishedByType: "admin" | "user";
  install: MarketplaceSkillInstallSpec;
};

export type MarketplaceMcpItemSummary = MarketplaceItemSummaryBase & {
  type: "mcp";
  install: MarketplaceMcpInstallSpec;
  vendor?: string;
  docsUrl?: string;
  iconUrl?: string;
  transportTypes: Array<"stdio" | "http" | "sse">;
  trust: {
    level: "official" | "verified" | "community";
    notes?: string;
  };
};

export type MarketplaceItemSummary =
  | MarketplacePluginItemSummary
  | MarketplaceSkillItemSummary
  | MarketplaceMcpItemSummary;

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
