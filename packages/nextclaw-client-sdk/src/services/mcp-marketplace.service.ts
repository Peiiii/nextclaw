import type {
  MarketplaceInstalledView,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceMcpContentView,
  MarketplaceMcpDoctorResult,
  MarketplaceMcpInstallRequest,
  MarketplaceMcpInstallResult,
  MarketplaceMcpManageRequest,
  MarketplaceMcpManageResult,
  MarketplaceRecommendationView,
  MarketplaceSort
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export type McpMarketplaceListParams = {
  q?: string;
  tag?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export class McpMarketplaceService {
  constructor(private readonly requestService: RequestService) {}

  readonly fetchItems = async (params: McpMarketplaceListParams = {}): Promise<MarketplaceListView> => {
    return await this.requestService.get<MarketplaceListView>("/api/marketplace/mcp/items", {
      query: toMcpListQuery(params)
    });
  };

  readonly fetchInstalled = async (): Promise<MarketplaceInstalledView> => {
    return await this.requestService.get<MarketplaceInstalledView>("/api/marketplace/mcp/installed");
  };

  readonly fetchItem = async (slug: string): Promise<MarketplaceItemView> => {
    return await this.requestService.get<MarketplaceItemView>(
      `/api/marketplace/mcp/items/${encodeURIComponent(slug)}`
    );
  };

  readonly fetchContent = async (slug: string): Promise<MarketplaceMcpContentView> => {
    return await this.requestService.get<MarketplaceMcpContentView>(
      `/api/marketplace/mcp/items/${encodeURIComponent(slug)}/content`
    );
  };

  readonly fetchRecommendations = async (
    params: { scene?: string; limit?: number } = {}
  ): Promise<MarketplaceRecommendationView> => {
    return await this.requestService.get<MarketplaceRecommendationView>("/api/marketplace/mcp/recommendations", {
      query: {
        ...(params.scene?.trim() ? { scene: params.scene.trim() } : {}),
        ...(typeof params.limit === "number" && Number.isFinite(params.limit)
          ? { limit: Math.max(1, Math.trunc(params.limit)) }
          : {})
      }
    });
  };

  readonly install = async (request: MarketplaceMcpInstallRequest): Promise<MarketplaceMcpInstallResult> => {
    return await this.requestService.post<MarketplaceMcpInstallResult>("/api/marketplace/mcp/install", request);
  };

  readonly manage = async (request: MarketplaceMcpManageRequest): Promise<MarketplaceMcpManageResult> => {
    return await this.requestService.post<MarketplaceMcpManageResult>("/api/marketplace/mcp/manage", request);
  };

  readonly doctor = async (name: string): Promise<MarketplaceMcpDoctorResult> => {
    return await this.requestService.post<MarketplaceMcpDoctorResult>("/api/marketplace/mcp/doctor", { name });
  };
}

function toMcpListQuery(params: McpMarketplaceListParams): Record<string, string | number> | undefined {
  const { page, pageSize, q, sort, tag } = params;
  const query: Record<string, string | number> = {};
  if (q?.trim()) {
    query.q = q.trim();
  }
  if (tag?.trim()) {
    query.tag = tag.trim();
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
