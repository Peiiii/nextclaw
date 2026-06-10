import { resolve } from "node:path";
import {
  SkillManager,
  type LocalizedTextMap,
} from "@nextclaw/kernel";
import { readMarketplaceEnvelope, resolveMarketplaceApiBase } from "@nextclaw-service/utils/marketplace/marketplace-client.utils.js";
import { runWithMarketplaceNetworkRetry } from "@nextclaw-service/utils/marketplace/marketplace-network-retry.utils.js";

type MarketplaceSkillSort = "relevance" | "updated";
type MarketplaceSkillInstallKind = "builtin" | "marketplace";

type MarketplaceInstallSpec = {
  kind: MarketplaceSkillInstallKind;
  spec: string;
  command: string;
};

type MarketplaceSkillItemSummary = {
  id: string;
  slug: string;
  type: "skill";
  name: string;
  summary: string;
  summaryI18n: LocalizedTextMap;
  tags: string[];
  author: string;
  install: MarketplaceInstallSpec;
  updatedAt: string;
};

type MarketplaceSkillItemView = MarketplaceSkillItemSummary & {
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  sourceRepo?: string;
  homepage?: string;
  publishedAt: string;
};

type MarketplaceSkillContentView = {
  type: "skill";
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: "builtin" | "marketplace" | "remote";
  raw: string;
  metadataRaw?: string;
  bodyRaw: string;
  sourceUrl?: string;
};

type MarketplaceSkillListView = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: MarketplaceSkillSort;
  query?: string;
  items: MarketplaceSkillItemSummary[];
};

type MarketplaceSkillRecommendationView = {
  type: "skill";
  sceneId: string;
  title: string;
  description?: string;
  total: number;
  items: MarketplaceSkillItemSummary[];
};

export type MarketplaceSkillsSearchView = MarketplaceSkillListView & {
  apiBaseUrl: string;
};

export type MarketplaceSkillInfoView = {
  apiBaseUrl: string;
  item: MarketplaceSkillItemView;
  content: MarketplaceSkillContentView | null;
  contentUnavailableReason: string | null;
};

export type MarketplaceSkillsRecommendationResultView = MarketplaceSkillRecommendationView & {
  apiBaseUrl: string;
};

export class SkillsQueryService {
  listInstalled = (params: {
    workdir: string;
    query?: string;
    scope?: string;
  }) => {
    return new SkillManager({ workspace: resolve(params.workdir) }).listInstalledSkills({
      scope: params.scope,
      query: params.query,
    });
  };

  getInstalledInfo = (params: {
    workdir: string;
    selector: string;
  }) => {
    const skillManager = new SkillManager({ workspace: resolve(params.workdir) });
    const detail = skillManager.getInstalledSkillDetail(params.selector);
    if (!detail) {
      throw new Error(`Installed skill not found: ${params.selector}`);
    }
    return detail;
  };

  searchMarketplaceSkills = async (params: {
    apiBaseUrl?: string;
    query?: string;
    tag?: string;
    sort?: string;
    page?: string | number;
    pageSize?: string | number;
  }): Promise<MarketplaceSkillsSearchView> => {
    const { apiBaseUrl: rawApiBaseUrl, page, pageSize, query, sort, tag } = params;
    const apiBaseUrl = resolveMarketplaceApiBase(rawApiBaseUrl);
    const result = await this.fetchMarketplaceView<MarketplaceSkillListView>({
      apiBaseUrl,
      path: "/api/v1/skills/items",
      query: {
        q: this.normalizeOptionalString(query) ?? undefined,
        tag: this.normalizeOptionalString(tag) ?? undefined,
        sort: this.normalizeMarketplaceSort(sort),
        page: this.normalizePositiveInteger(page),
        pageSize: this.normalizePositiveInteger(pageSize),
      },
    });

    return {
      apiBaseUrl,
      ...result,
      items: result.items.map((item) => this.normalizeMarketplaceSummary(item)),
    };
  };

  getMarketplaceSkillInfo = async (params: {
    apiBaseUrl?: string;
    slug: string;
  }): Promise<MarketplaceSkillInfoView> => {
    const slug = this.normalizeRequiredString(params.slug, "skill slug");
    const apiBaseUrl = resolveMarketplaceApiBase(params.apiBaseUrl);
    const encodedSlug = encodeURIComponent(slug);

    const item = await this.fetchMarketplaceView<MarketplaceSkillItemView>({
        apiBaseUrl,
        path: `/api/v1/skills/items/${encodedSlug}`,
      });

    let content: MarketplaceSkillContentView | null = null;
    let contentUnavailableReason: string | null = null;
    try {
      content = this.normalizeMarketplaceContent(await this.fetchMarketplaceView<MarketplaceSkillContentView>({
        apiBaseUrl,
        path: `/api/v1/skills/items/${encodedSlug}/content`,
      }));
    } catch (error) {
      contentUnavailableReason = error instanceof Error ? error.message : String(error);
    }

    return {
      apiBaseUrl,
      item: this.normalizeMarketplaceItem(item),
      content,
      contentUnavailableReason,
    };
  };

  recommendMarketplaceSkills = async (params: {
    apiBaseUrl?: string;
    scene?: string;
    limit?: string | number;
  }): Promise<MarketplaceSkillsRecommendationResultView> => {
    const apiBaseUrl = resolveMarketplaceApiBase(params.apiBaseUrl);
    const result = await this.fetchMarketplaceView<MarketplaceSkillRecommendationView>({
      apiBaseUrl,
      path: "/api/v1/skills/recommendations",
      query: {
        scene: this.normalizeOptionalString(params.scene) ?? undefined,
        limit: this.normalizePositiveInteger(params.limit),
      },
    });

    return {
      apiBaseUrl,
      ...result,
      items: result.items.map((item) => this.normalizeMarketplaceSummary(item)),
    };
  };

  private normalizeMarketplaceSummary = (
    item: MarketplaceSkillItemSummary,
  ): MarketplaceSkillItemSummary => ({
    ...item,
    install: this.normalizeMarketplaceInstallSpec(item.install, item.slug),
  });

  private normalizeMarketplaceItem = (
    item: MarketplaceSkillItemView,
  ): MarketplaceSkillItemView => ({
    ...item,
    install: this.normalizeMarketplaceInstallSpec(item.install, item.slug),
  });

  private normalizeMarketplaceContent = (
    content: MarketplaceSkillContentView,
  ): MarketplaceSkillContentView => ({
    ...content,
    install: this.normalizeMarketplaceInstallSpec(content.install, content.slug),
  });

  private normalizeMarketplaceInstallSpec = (
    install: MarketplaceInstallSpec,
    slug: string,
  ): MarketplaceInstallSpec => ({
    ...install,
    command: `nextclaw marketplace skills install ${slug}`,
  });

  private normalizeMarketplaceSort = (value: string | undefined): MarketplaceSkillSort | undefined => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      return undefined;
    }
    if (normalized === "relevance" || normalized === "updated") {
      return normalized;
    }
    throw new Error(`Invalid marketplace sort: ${value}. Expected relevance or updated.`);
  };

  private normalizePositiveInteger = (value: string | number | undefined): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Expected a positive integer, received: ${String(value)}`);
    }
    return String(Math.floor(parsed));
  };

  private normalizeRequiredString = (value: string, label: string): string => {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new Error(`Missing ${label}`);
    }
    return normalized;
  };

  private normalizeOptionalString = (value: string | undefined): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  private fetchMarketplaceView = async <T>(params: {
    apiBaseUrl: string;
    path: string;
    query?: Record<string, string | undefined>;
  }): Promise<T> => {
    const url = new URL(params.path, `${params.apiBaseUrl}/`);
    for (const [key, value] of Object.entries(params.query ?? {})) {
      if (typeof value === "string" && value.length > 0) {
        url.searchParams.set(key, value);
      }
    }

    const response = await runWithMarketplaceNetworkRetry(async () =>
      await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      })
    );

    const payload = await readMarketplaceEnvelope<T>(response);
    if (!payload.ok || !payload.data) {
      const message = payload.error?.message || `marketplace request failed: ${response.status}`;
      throw new Error(message);
    }

    return payload.data;
  };
}
