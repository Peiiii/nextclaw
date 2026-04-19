import type { AppFilesResult, AppItemDetail, AppListResult } from "./app.types.js";

const DEFAULT_API_BASE = "https://apps-registry.nextclaw.io";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
};

export class AppsMarketplaceClient {
  constructor(
    private readonly apiBase = (import.meta.env.VITE_APPS_MARKETPLACE_API_BASE as string | undefined) ?? DEFAULT_API_BASE,
  ) {}

  listApps = async (params?: {
    q?: string;
    tag?: string;
    page?: number;
    pageSize?: number;
  }): Promise<AppListResult> => {
    const { q, tag, page, pageSize } = params ?? {};
    const search = new URLSearchParams();
    if (q) {
      search.set("q", q);
    }
    if (tag) {
      search.set("tag", tag);
    }
    if (page) {
      search.set("page", String(page));
    }
    if (pageSize) {
      search.set("pageSize", String(pageSize));
    }
    return await this.request<AppListResult>(`/api/v1/apps/items?${search.toString()}`);
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
    const response = await fetch(`${this.apiBase}${readme.downloadPath}`);
    if (!response.ok) {
      throw new Error(`failed to load README for ${selector}`);
    }
    return await response.text();
  };

  private request = async <T>(pathname: string): Promise<T> => {
    const response = await fetch(`${this.apiBase}${pathname}`);
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(`apps api request failed: ${response.status} ${response.statusText}`);
    }
    return payload.data;
  };
}

export const appsMarketplaceClient = new AppsMarketplaceClient();
