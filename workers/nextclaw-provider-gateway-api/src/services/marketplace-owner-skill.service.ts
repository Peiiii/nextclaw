import type {
  Env,
  OwnerMarketplaceSkillDetailView,
  OwnerMarketplaceSkillListView,
  OwnerMarketplaceSkillManageAction,
} from "@/types/platform";

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

export class MarketplaceOwnerSkillService {
  private readonly baseUrl: string;
  private readonly requestAuthorization: string | null;

  constructor(private readonly env: Env, requestAuthorization?: string | null) {
    this.baseUrl = this.resolveBaseUrl();
    this.requestAuthorization = requestAuthorization?.trim() || null;
  }

  listSkills = async (query: { q?: string }): Promise<OwnerMarketplaceSkillListView> => {
    const params = new URLSearchParams();
    if (query.q) {
      params.set("q", query.q);
    }
    const suffix = params.toString();
    return await this.requestJson<OwnerMarketplaceSkillListView>(
      suffix ? `/api/v1/user/skills/items?${suffix}` : "/api/v1/user/skills/items"
    );
  };

  getSkillDetail = async (selector: string): Promise<OwnerMarketplaceSkillDetailView | null> => {
    return await this.requestJsonOrNull<OwnerMarketplaceSkillDetailView>(
      `/api/v1/user/skills/items/${encodeURIComponent(selector)}`
    );
  };

  manageSkill = async (payload: { selector: string; action: OwnerMarketplaceSkillManageAction }): Promise<{ item: OwnerMarketplaceSkillDetailView }> => {
    return await this.requestJson<{ item: OwnerMarketplaceSkillDetailView }>("/api/v1/user/skills/manage", {
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
    if (this.requestAuthorization) {
      headers.set("authorization", this.requestAuthorization);
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
      throw new Error(errorMessage || `Marketplace owner request failed: ${response.status}`);
    }

    if (!payload || !("ok" in payload) || payload.ok !== true) {
      throw new Error("Marketplace owner response is invalid.");
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
}
