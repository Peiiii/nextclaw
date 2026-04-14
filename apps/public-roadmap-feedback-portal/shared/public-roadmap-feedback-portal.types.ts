export const PUBLIC_PHASES = [
  "considering",
  "planned",
  "building",
  "reviewing",
  "shipped",
  "closed"
] as const;

export type PublicPhase = (typeof PUBLIC_PHASES)[number];

export const PUBLIC_ITEM_TYPES = [
  "feature",
  "bug",
  "improvement",
  "research"
] as const;

export type PublicItemType = (typeof PUBLIC_ITEM_TYPES)[number];

export type PortalDataMode = "preview" | "live";

export type RoadmapViewMode = "board" | "list";

export type ItemSortMode = "recent" | "hot";

export type PublicItemSource = "manual-official" | "linear" | "community";

export type EngagementSummary = {
  voteCount: number;
  commentCount: number;
  linkedFeedbackCount: number;
};

export type SourceMetadata = {
  provider: PublicItemSource;
  sourceLabel: string;
  sourceStatus: string;
  sourceUrl: string | null;
  teamName: string | null;
  labelNames: string[];
};

export type PublicItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  publicPhase: PublicPhase;
  type: PublicItemType;
  source: PublicItemSource;
  isOfficial: boolean;
  tags: string[];
  updatedAt: string;
  shippedAt: string | null;
  engagement: EngagementSummary;
  sourceMetadata: SourceMetadata;
};

export type PhaseSummary = {
  phase: PublicPhase;
  count: number;
};

export type PortalOverview = {
  generatedAt: string;
  mode: PortalDataMode;
  summary: {
    totalItems: number;
    activeItems: number;
    shippedItems: number;
    buildingItems: number;
    reviewingItems: number;
    totalSignals: number;
  };
  phaseSummary: PhaseSummary[];
  currentFocus: PublicItem[];
  shippedHighlights: PublicItem[];
};

export type ItemsQuery = {
  phase?: PublicPhase | "all";
  type?: PublicItemType | "all";
  sort?: ItemSortMode;
  view?: RoadmapViewMode;
};

export type ItemsResponse = {
  generatedAt: string;
  mode: PortalDataMode;
  items: PublicItem[];
};

export type UpdatesResponse = {
  generatedAt: string;
  mode: PortalDataMode;
  items: PublicItem[];
};

export type PublicItemDetail = {
  item: PublicItem;
  relatedItems: PublicItem[];
};

export type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };
