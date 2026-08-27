const DEFAULT_APPS_MARKETPLACE_API_BASE = "https://apps-registry.nextclaw.io";

export type AppMarketplaceItem = {
  appId: string;
  name: string;
  summary: string;
  latestVersion: string;
  tags: string[];
  author: string;
  availability?: { targets: string[] };
  install: {
    spec: string;
    registry: string;
  };
};

export type AppMarketplaceSearchResult = {
  items: AppMarketplaceItem[];
  hasMore: boolean;
  nextCursor?: string;
};

type ApiEnvelope<T> = { ok: boolean; data: T };

export class AppMarketplaceQueryService {
  constructor(private readonly params: {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
  } = {}) {}

  search = async (options: {
    query?: string;
    tag?: string;
    cursor?: string;
    limit?: number;
  } = {}): Promise<AppMarketplaceSearchResult> => {
    const search = new URLSearchParams();
    if (options.query?.trim()) search.set("q", options.query.trim());
    if (options.tag?.trim()) search.set("tag", options.tag.trim());
    if (options.cursor?.trim()) search.set("cursor", options.cursor.trim());
    search.set("limit", String(this.normalizeLimit(options.limit)));
    return this.normalizeSearchResult(await this.request<AppMarketplaceSearchResult>(
      `/api/v2/apps/items?${search.toString()}`,
    ));
  };

  info = async (selector: string): Promise<AppMarketplaceItem> => {
    const normalized = selector.trim();
    if (!normalized) throw new Error("Marketplace app selector is required.");
    return this.normalizeItem(await this.request<AppMarketplaceItem>(
      `/api/v1/apps/items/${encodeURIComponent(normalized)}`,
    ));
  };

  private request = async <T>(pathname: string): Promise<T> => {
    const response = await (this.params.fetchImpl ?? fetch)(`${this.apiBaseUrl}${pathname}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(`Apps marketplace request failed: ${response.status} ${response.statusText}`);
    }
    return payload.data;
  };

  private normalizeSearchResult = (result: AppMarketplaceSearchResult): AppMarketplaceSearchResult => ({
    ...result,
    items: result.items.map((item) => this.normalizeItem(item)),
  });

  private normalizeItem = (item: AppMarketplaceItem): AppMarketplaceItem => ({
    ...item,
    install: {
      spec: item.install.spec,
      registry: item.install.registry,
    },
  });

  private get apiBaseUrl(): string {
    return (this.params.apiBaseUrl ?? DEFAULT_APPS_MARKETPLACE_API_BASE).replace(/\/+$/, "");
  }

  private normalizeLimit = (limit: number | undefined): number => {
    if (limit === undefined) return 24;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("--limit must be an integer between 1 and 100.");
    }
    return limit;
  };
}
