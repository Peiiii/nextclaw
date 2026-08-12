import type {
  AppFilesResult,
  AppItemDetail,
  AppListResult,
} from "@/features/app-marketplace/types/app-marketplace.types.js";

const DEFAULT_API_BASE = "https://apps-registry.nextclaw.io";
const REQUEST_TIMEOUT_MS = 8000;
const UNSUPPORTED_CATALOG_STATUSES = new Set([404, 405, 501]);

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
};

type LegacyAppListResult = {
  items: AppListResult["items"];
};

export class AppsMarketplaceClient {
  constructor(
    private readonly apiBase = (import.meta.env.VITE_APPS_MARKETPLACE_API_BASE as string | undefined) ?? DEFAULT_API_BASE,
  ) {}

  listApps = async (params?: {
    q?: string;
    tag?: string;
    publisher?: string;
    featured?: boolean;
    cursor?: string;
    limit?: number;
    sort?: "relevance" | "featured" | "updated";
  }): Promise<AppListResult> => {
    const { cursor, featured, limit, publisher, q, sort, tag } = params ?? {};
    const search = new URLSearchParams();
    if (q) {
      search.set("q", q);
    }
    if (tag) {
      search.set("tag", tag);
    }
    if (publisher) {
      search.set("publisher", publisher);
    }
    if (featured !== undefined) {
      search.set("featured", String(featured));
    }
    if (cursor) {
      search.set("cursor", cursor);
    }
    search.set("limit", String(limit ?? 24));
    if (sort) {
      search.set("sort", sort);
    }
    const response = await this.fetchWithTimeout(
      `${this.apiBase}/api/v2/apps/items?${search.toString()}`,
    );
    if (UNSUPPORTED_CATALOG_STATUSES.has(response.status)) {
      return await this.listAppsFromLegacyCatalog({ featured, publisher, q, sort, tag });
    }
    return await this.readResponse<AppListResult>(response);
  };

  getApp = async (selector: string): Promise<AppItemDetail> => {
    return await this.request<AppItemDetail>(`/api/v1/apps/items/${encodeURIComponent(selector)}`);
  };

  getFiles = async (selector: string): Promise<AppFilesResult> => {
    return await this.request<AppFilesResult>(`/api/v1/apps/items/${encodeURIComponent(selector)}/files`);
  };

  getReadme = async (selector: string): Promise<string | null> => {
    const files = await this.getFiles(selector);
    const readme = files.files.find((file: AppFilesResult["files"][number]) => file.path === "README.md");
    if (!readme) {
      return null;
    }
    const response = await this.fetchWithTimeout(`${this.apiBase}${readme.downloadPath}`);
    if (!response.ok) {
      throw new Error(`failed to load README for ${selector}`);
    }
    return await response.text();
  };

  private request = async <T>(pathname: string): Promise<T> => {
    const response = await this.fetchWithTimeout(`${this.apiBase}${pathname}`);
    return await this.readResponse<T>(response);
  };

  private readResponse = async <T>(response: Response): Promise<T> => {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(`apps api request failed: ${response.status} ${response.statusText}`);
    }
    return payload.data;
  };

  private listAppsFromLegacyCatalog = async (params: {
    q?: string;
    tag?: string;
    publisher?: string;
    featured?: boolean;
    sort?: "relevance" | "featured" | "updated";
  }): Promise<AppListResult> => {
    const { featured, publisher, q, sort, tag } = params;
    const search = new URLSearchParams({ page: "1", pageSize: "100" });
    if (q) search.set("q", q);
    if (tag) search.set("tag", tag);
    const legacy = await this.request<LegacyAppListResult>(
      `/api/v1/apps/items?${search.toString()}`,
    );
    return {
      items: legacy.items
        .filter((item) => !publisher || item.publisher.id === publisher)
        .filter((item) => featured === undefined || item.featured === featured),
      hasMore: false,
      query: q,
      tag,
      publisher,
      featured,
      sort: sort ?? (q ? "relevance" : "featured"),
    };
  };

  private readonly fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };
}

export const appsMarketplaceClient = new AppsMarketplaceClient();
