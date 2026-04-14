import type {
  ApiEnvelope,
  ItemsQuery,
  ItemsResponse,
  PortalOverview,
  PublicItemDetail,
  UpdatesResponse
} from "@shared/public-roadmap-feedback-portal.types";

class PortalApiService {
  readonly baseUrl: string;

  constructor(baseUrl = (import.meta.env.VITE_PUBLIC_ROADMAP_FEEDBACK_PORTAL_API_BASE ?? "").replace(/\/+$/, "")) {
    this.baseUrl = baseUrl;
  }

  getOverview = async (): Promise<PortalOverview> => {
    return await this.fetchJson<PortalOverview>("/api/overview");
  };

  getItems = async (query: ItemsQuery): Promise<ItemsResponse> => {
    const params = new URLSearchParams();
    if (query.phase) {
      params.set("phase", query.phase);
    }
    if (query.type) {
      params.set("type", query.type);
    }
    if (query.sort) {
      params.set("sort", query.sort);
    }
    if (query.view) {
      params.set("view", query.view);
    }
    return await this.fetchJson<ItemsResponse>(`/api/items?${params.toString()}`);
  };

  getItemDetail = async (itemId: string): Promise<PublicItemDetail> => {
    return await this.fetchJson<PublicItemDetail>(`/api/items/${encodeURIComponent(itemId)}`);
  };

  getUpdates = async (): Promise<UpdatesResponse> => {
    return await this.fetchJson<UpdatesResponse>("/api/updates");
  };

  private fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(this.createUrl(path));
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !payload.ok) {
      const message = payload.ok ? `Request failed: ${path}` : payload.error.message;
      throw new Error(message);
    }
    return payload.data;
  };

  private createUrl = (path: string): string => {
    return this.baseUrl ? `${this.baseUrl}${path}` : path;
  };
}

export const portalApiService = new PortalApiService();
