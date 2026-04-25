import type {
  MarketplaceCatalogSection,
  MarketplaceItem,
  MarketplaceItemSummary,
  MarketplaceListQuery,
  MarketplaceListResult,
  MarketplaceRecommendationResult,
  MarketplaceSort
} from "../domain/model";
import type { MarketplaceSectionDataSource } from "../domain/repository";

type CacheEntry = {
  section: MarketplaceCatalogSection;
  expiresAt: number;
};

type ScoreEntry = {
  item: MarketplaceItem;
  score: number;
};

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export abstract class InMemorySectionRepositoryBase {
  private cache?: CacheEntry;
  private readonly cacheTtlMs: number;

  protected constructor(
    private readonly dataSource: MarketplaceSectionDataSource,
    options: RepositoryOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? 120_000;
  }

  protected abstract getResultType(): "plugin" | "skill" | "mcp";

  listItems = async (query: MarketplaceListQuery): Promise<MarketplaceListResult> => {
    const section = await this.loadSection();
    const filtered = this.filterItems(section.items, query);
    const sorted = this.sortItems(filtered, query.sort, query.q);

    const total = sorted.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
    const start = (query.page - 1) * query.pageSize;
    const pageItems = sorted.slice(start, start + query.pageSize).map((entry) => this.toSummary(entry.item));

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
      sort: query.sort,
      query: query.q,
      items: pageItems
    };
  };

  getItemBySlug = async (slug: string): Promise<MarketplaceItem | null> => {
    const section = await this.loadSection();
    const item = section.items.find((entry) => entry.slug === slug || (entry.type === "skill" && entry.packageName === slug));

    return item ?? null;
  };

  listRecommendations = async (
    sceneId: string | undefined,
    limit: number
  ): Promise<MarketplaceRecommendationResult> => {
    const section = await this.loadSection();
    const selectedScene = this.selectScene(section, sceneId);
    const selectedItems = selectedScene.itemIds
      .map((itemId) => section.items.find((entry) => entry.id === itemId))
      .filter((entry): entry is MarketplaceItem => Boolean(entry))
      .slice(0, limit)
      .map((entry) => this.toSummary(entry));

    return {
      type: this.getResultType(),
      sceneId: selectedScene.id,
      title: selectedScene.title,
      description: selectedScene.description,
      total: selectedItems.length,
      items: selectedItems
    };
  };

  invalidateCache = (): void => {
    this.cache = undefined;
  };

  private loadSection = async (): Promise<MarketplaceCatalogSection> => {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.section;
    }

    const section = await this.dataSource.loadSection();
    this.cache = {
      section,
      expiresAt: now + this.cacheTtlMs
    };
    return section;
  };

  private filterItems = (items: MarketplaceItem[], query: MarketplaceListQuery): ScoreEntry[] => {
    return items
      .filter((item) => this.matchesTag(item, query.tag))
      .map((item) => ({
        item,
        score: this.computeScore(item, query.q)
      }))
      .filter((entry) => this.matchesQuery(entry.score, query.q));
  };

  private matchesTag = (item: MarketplaceItem, tag: string | undefined): boolean => {
    if (!tag) {
      return true;
    }
    const normalizedTag = tag.toLowerCase();
    return item.tags.some((entry) => entry.toLowerCase() === normalizedTag);
  };

  private matchesQuery = (score: number, q: string | undefined): boolean => {
    if (!q) {
      return true;
    }
    return score > 0;
  };
  private computeScore = (item: MarketplaceItem, q: string | undefined): number => {
    const normalized = q?.trim().toLowerCase() ?? "";
    const compactQuery = normalized.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    if (!compactQuery) {
      return 0;
    }
    const terms = normalized.split(/[\s/_-]+/).map((term) => term.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")).filter(Boolean);
    const name = item.name.toLowerCase();
    const slug = item.slug.toLowerCase();
    const summary = item.summary.toLowerCase();
    const packageName = item.type === "skill" ? item.packageName.toLowerCase() : "";
    const summaryLocalized = Object.values(item.summaryI18n).map((text) => text.toLowerCase());
    const description = item.description?.toLowerCase() ?? "";
    const descriptionLocalized = Object.values(item.descriptionI18n ?? {}).map((text) => text.toLowerCase());
    const tags = item.tags.map((tag) => tag.toLowerCase());
    const values = [name, slug, packageName, summary, description, ...summaryLocalized, ...descriptionLocalized, ...tags];
    if (!terms.every((term) => values.some((value) => value.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "").includes(term)))) {
      return 0;
    }
    return this.scoreStringMatch(name, normalized, compactQuery, terms, 8)
      + this.scoreStringMatch(slug, normalized, compactQuery, terms, 5)
      + this.scoreStringMatch(packageName, normalized, compactQuery, terms, 5)
      + this.scoreStringMatch(summary, normalized, compactQuery, terms, 3)
      + this.scoreArrayMatch(summaryLocalized, normalized, compactQuery, terms, 3)
      + this.scoreStringMatch(description, normalized, compactQuery, terms, 2)
      + this.scoreArrayMatch(descriptionLocalized, normalized, compactQuery, terms, 2)
      + this.scoreArrayMatch(tags, normalized, compactQuery, terms, 4);
  };
  private scoreStringMatch = (value: string, query: string, compactQuery: string, terms: string[], score: number): number => {
    const compact = value.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    return value.includes(query) || compact.includes(compactQuery) || terms.every((term) => compact.includes(term)) ? score : 0;
  };
  private scoreArrayMatch = (values: string[], query: string, compactQuery: string, terms: string[], score: number): number => {
    return values.some((value) => this.scoreStringMatch(value, query, compactQuery, terms, score) > 0) ? score : 0;
  };
  private sortItems = (entries: ScoreEntry[], sort: MarketplaceSort, q: string | undefined): ScoreEntry[] => {
    const next = [...entries];

    if (sort === "updated") {
      next.sort((left, right) => this.compareUpdatedAt(left.item, right.item));
      return next;
    }

    if (!q || !q.trim()) {
      next.sort((left, right) => this.compareUpdatedAt(left.item, right.item));
      return next;
    }

    next.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return this.compareUpdatedAt(left.item, right.item);
    });

    return next;
  };

  private compareUpdatedAt = (left: MarketplaceItem, right: MarketplaceItem): number => {
    const leftTs = Date.parse(left.updatedAt);
    const rightTs = Date.parse(right.updatedAt);

    if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return rightTs - leftTs;
  };

  private selectScene = (section: MarketplaceCatalogSection, sceneId?: string) => {
    if (!sceneId) {
      return section.recommendations[0] ?? {
        id: "default",
        title: "Recommendations",
        itemIds: []
      };
    }

    const sceneAliases = [sceneId, `${this.getResultType()}s-${sceneId}`];
    const matched = section.recommendations.find((scene) => sceneAliases.includes(scene.id));
    if (matched) {
      return matched;
    }

    return {
      id: sceneId,
      title: sceneId,
      itemIds: []
    };
  };

  private toSummary = (item: MarketplaceItem): MarketplaceItemSummary => {
    const base = {
      id: item.id,
      slug: item.slug,
      name: item.name,
      summary: item.summary,
      summaryI18n: item.summaryI18n,
      tags: item.tags,
      author: item.author,
      updatedAt: item.updatedAt
    };

    if (item.type === "plugin") {
      return {
        ...base,
        type: "plugin",
        install: item.install
      };
    }

    if (item.type === "mcp") {
      return {
        ...base,
        type: "mcp",
        install: item.install,
        vendor: item.vendor,
        docsUrl: item.docsUrl,
        iconUrl: item.iconUrl,
        transportTypes: item.transportTypes,
        trust: item.trust
      };
    }

    return {
      ...base,
      type: "skill",
      packageName: item.packageName,
      ownerScope: item.ownerScope,
      skillName: item.skillName,
      publishStatus: item.publishStatus,
      publishedByType: item.publishedByType,
      install: item.install
    };
  };
}
