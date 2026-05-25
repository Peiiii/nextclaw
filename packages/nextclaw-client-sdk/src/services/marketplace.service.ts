import type {
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceItemType,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceManageRequest,
  MarketplaceManageResult,
  MarketplaceRecommendationView,
  MarketplaceScenesView,
  MarketplaceSkillContentView,
  MarketplaceSort
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export type MarketplaceListParams = {
  type: MarketplaceItemType;
  q?: string;
  tag?: string;
  scene?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export class MarketplaceService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetchItems = async (params: MarketplaceListParams): Promise<MarketplaceListView> => {
    return await this.requestService.get<MarketplaceListView>(`${toMarketplaceBasePath(params.type)}/items`, {
      query: toListQuery(params)
    });
  };

  readonly fetchItem = async (slug: string, type: MarketplaceItemType): Promise<MarketplaceItemView> => {
    return await this.requestService.get<MarketplaceItemView>(
      `${toMarketplaceBasePath(type)}/items/${encodeURIComponent(slug)}`
    );
  };

  readonly fetchSkillContent = async (slug: string): Promise<MarketplaceSkillContentView> => {
    return await this.requestService.get<MarketplaceSkillContentView>(
      `/api/marketplace/skills/items/${encodeURIComponent(slug)}/content`
    );
  };

  readonly fetchRecommendations = async (
    type: MarketplaceItemType,
    params: { scene?: string; limit?: number } = {}
  ): Promise<MarketplaceRecommendationView> => {
    return await this.requestService.get<MarketplaceRecommendationView>(
      `${toMarketplaceBasePath(type)}/recommendations`,
      {
        query: {
          ...(params.scene?.trim() ? { scene: params.scene.trim() } : {}),
          ...(typeof params.limit === "number" && Number.isFinite(params.limit)
            ? { limit: Math.max(1, Math.trunc(params.limit)) }
            : {})
        }
      }
    );
  };

  readonly fetchSkillScenes = async (): Promise<MarketplaceScenesView> => {
    return await this.requestService.get<MarketplaceScenesView>("/api/marketplace/skills/scenes");
  };

  readonly install = async (request: MarketplaceInstallRequest): Promise<MarketplaceInstallResult> => {
    return await this.requestService.post<MarketplaceInstallResult>(
      `${toMarketplaceBasePath(resolveRequiredMarketplaceType(request.type))}/install`,
      request
    );
  };

  readonly fetchInstalled = async (type: MarketplaceItemType): Promise<MarketplaceInstalledView> => {
    return await this.requestService.get<MarketplaceInstalledView>(`${toMarketplaceBasePath(type)}/installed`);
  };

  readonly manage = async (request: MarketplaceManageRequest): Promise<MarketplaceManageResult> => {
    return await this.requestService.post<MarketplaceManageResult>(
      `${toMarketplaceBasePath(resolveRequiredMarketplaceType(request.type))}/manage`,
      request
    );
  };
}

function toMarketplaceBasePath(type: MarketplaceItemType): string {
  if (type === "skill") {
    return "/api/marketplace/skills";
  }
  return "/api/marketplace/mcp";
}

function toListQuery(params: MarketplaceListParams): Record<string, string | number> | undefined {
  const { page, pageSize, q, scene, sort, tag } = params;
  const query: Record<string, string | number> = {};
  if (q?.trim()) {
    query.q = q.trim();
  }
  if (tag?.trim()) {
    query.tag = tag.trim();
  }
  if (scene?.trim()) {
    query.scene = scene.trim();
  }
  if (sort) {
    query.sort = sort;
  }
  if (typeof page === "number" && Number.isFinite(page)) {
    query.page = Math.max(1, Math.trunc(page));
  }
  if (typeof pageSize === "number" && Number.isFinite(pageSize)) {
    query.pageSize = Math.max(1, Math.trunc(pageSize));
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

function resolveRequiredMarketplaceType(type: MarketplaceItemType | undefined): MarketplaceItemType {
  if (!type) {
    throw new Error("Marketplace request type is required.");
  }
  return type;
}
