import type {
  AdminMarketplaceSkillDetailPayload,
  AdminMarketplaceSkillDetailView,
  AdminMarketplaceSkillListView,
  AdminMarketplaceSkillPublishStatus,
  AdminMarketplaceSkillReviewStatus,
  Env,
} from "../types/platform";

const DEFAULT_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";

type MarketplaceApiEnvelope<T> = {
  ok: true;
  data: T;
};

type MarketplaceApiFailure = {
  ok: false;
  error?: {
    message?: string;
  };
};

export class MarketplaceAdminService {
  private readonly baseUrl: string;
  private readonly adminToken: string | null;

  constructor(private readonly env: Env) {
    this.baseUrl = this.resolveBaseUrl();
    this.adminToken = this.resolveAdminToken();
  }

  listSkills = async (query: {
    publishStatus: AdminMarketplaceSkillPublishStatus;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<AdminMarketplaceSkillListView> => {
    const params = new URLSearchParams();
    params.set("publishStatus", query.publishStatus);
    params.set("page", String(query.page));
    params.set("pageSize", String(query.pageSize));
    if (query.q) {
      params.set("q", query.q);
    }

    return await this.requestJson<AdminMarketplaceSkillListView>(`/api/v1/admin/skills/items?${params.toString()}`);
  };

  getSkillDetail = async (selector: string): Promise<AdminMarketplaceSkillDetailPayload | null> => {
    return await this.requestJsonOrNull<AdminMarketplaceSkillDetailPayload>(
      `/api/v1/admin/skills/items/${encodeURIComponent(selector)}`
    );
  };

  reviewSkill = async (payload: {
    selector: string;
    publishStatus: AdminMarketplaceSkillReviewStatus;
    reviewNote?: string;
  }): Promise<{ item: AdminMarketplaceSkillDetailView }> => {
    return await this.requestJson<{ item: AdminMarketplaceSkillDetailView }>("/api/v1/admin/skills/review", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  };

  private requestJsonOrNull = async <T>(path: string, init: RequestInit = {}): Promise<T | null> => {
    const response = await this.request(path, init);
    if (response.status === 404) {
      return null;
    }
    return await this.readJsonResponse<T>(response);
  };

  private requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await this.request(path, init);
    return await this.readJsonResponse<T>(response);
  };

  private request = async (path: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers ?? {});
    headers.set("accept", "application/json");
    if (init.body) {
      headers.set("content-type", "application/json");
    }
    if (this.adminToken) {
      headers.set("authorization", `Bearer ${this.adminToken}`);
    }

    return await fetch(this.toUrl(path), {
      ...init,
      headers
    });
  };

  private readJsonResponse = async <T>(response: Response): Promise<T> => {
    const payload = await response.json<MarketplaceApiEnvelope<T> | MarketplaceApiFailure | null>().catch(() => null);
    if (!response.ok) {
      const errorMessage = payload && "ok" in payload && payload.ok === false
        ? payload.error?.message
        : undefined;
      throw new Error(errorMessage || `Marketplace admin request failed: ${response.status}`);
    }

    if (!payload || !("ok" in payload) || payload.ok !== true) {
      throw new Error("Marketplace admin response is invalid.");
    }

    return payload.data;
  };

  private toUrl = (path: string): string => {
    return path.startsWith("/") ? `${this.baseUrl}${path}` : `${this.baseUrl}/${path}`;
  };

  private resolveBaseUrl = (): string => {
    const baseUrl = this.env.MARKETPLACE_API_BASE?.trim() || DEFAULT_MARKETPLACE_API_BASE;
    return baseUrl.replace(/\/+$/, "");
  };

  private resolveAdminToken = (): string | null => {
    const token = this.env.MARKETPLACE_ADMIN_TOKEN?.trim();
    return token && token.length > 0 ? token : null;
  };
}
