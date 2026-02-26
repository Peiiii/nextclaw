import type {
  MarketplaceCatalogSection,
  MarketplaceCatalogSnapshot,
  MarketplaceItem,
  MarketplaceItemSummary,
  MarketplaceItemType,
  MarketplaceListQuery,
  MarketplaceListResult,
  MarketplaceRecommendationResult,
  MarketplaceSort
} from "../domain/model";
import type { MarketplaceDataSource, MarketplaceRepository } from "../domain/repository";

type CacheEntry = {
  snapshot: MarketplaceCatalogSnapshot;
  expiresAt: number;
};

type ScoreEntry = {
  item: MarketplaceItem;
  score: number;
};

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemoryMarketplaceRepository implements MarketplaceRepository {
  private cache?: CacheEntry;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly dataSource: MarketplaceDataSource,
    options: RepositoryOptions = {}
  ) {
    this.cacheTtlMs = options.cacheTtlMs ?? 120_000;
  }

  async listItems(type: MarketplaceItemType, query: MarketplaceListQuery): Promise<MarketplaceListResult> {
    const snapshot = await this.loadSnapshot();
    const section = this.selectSection(snapshot, type);
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
  }

  async getItemBySlug(type: MarketplaceItemType, slug: string): Promise<MarketplaceItem | null> {
    const snapshot = await this.loadSnapshot();
    const section = this.selectSection(snapshot, type);
    const item = section.items.find((entry) => entry.slug === slug);

    return item ?? null;
  }

  async listRecommendations(
    type: MarketplaceItemType,
    sceneId: string | undefined,
    limit: number
  ): Promise<MarketplaceRecommendationResult> {
    const snapshot = await this.loadSnapshot();
    const section = this.selectSection(snapshot, type);
    const selectedScene = this.selectScene(section, sceneId);
    const selectedItems = selectedScene.itemIds
      .map((itemId) => section.items.find((entry) => entry.id === itemId))
      .filter((entry): entry is MarketplaceItem => Boolean(entry))
      .slice(0, limit)
      .map((entry) => this.toSummary(entry));

    return {
      type,
      sceneId: selectedScene.id,
      title: selectedScene.title,
      description: selectedScene.description,
      total: selectedItems.length,
      items: selectedItems
    };
  }

  private async loadSnapshot(): Promise<MarketplaceCatalogSnapshot> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.snapshot;
    }

    const snapshot = await this.dataSource.loadSnapshot();
    this.cache = {
      snapshot,
      expiresAt: now + this.cacheTtlMs
    };
    return snapshot;
  }

  private filterItems(items: MarketplaceItem[], query: MarketplaceListQuery): ScoreEntry[] {
    return items
      .filter((item) => this.matchesTag(item, query.tag))
      .map((item) => ({
        item,
        score: this.computeScore(item, query.q)
      }))
      .filter((entry) => this.matchesQuery(entry.score, query.q));
  }

  private matchesTag(item: MarketplaceItem, tag: string | undefined): boolean {
    if (!tag) {
      return true;
    }
    const normalizedTag = tag.toLowerCase();
    return item.tags.some((entry) => entry.toLowerCase() === normalizedTag);
  }

  private matchesQuery(score: number, q: string | undefined): boolean {
    if (!q) {
      return true;
    }
    return score > 0;
  }

  private computeScore(item: MarketplaceItem, q: string | undefined): number {
    if (!q) {
      return 0;
    }

    const normalized = q.trim().toLowerCase();
    if (!normalized) {
      return 0;
    }

    let score = 0;
    const name = item.name.toLowerCase();
    const slug = item.slug.toLowerCase();
    const summary = item.summary.toLowerCase();
    const description = item.description?.toLowerCase() ?? "";
    const tags = item.tags.map((tag) => tag.toLowerCase());

    if (name.includes(normalized)) {
      score += 8;
    }
    if (slug.includes(normalized)) {
      score += 5;
    }
    if (summary.includes(normalized)) {
      score += 3;
    }
    if (description.includes(normalized)) {
      score += 2;
    }
    if (tags.some((tag) => tag.includes(normalized))) {
      score += 4;
    }

    return score;
  }

  private sortItems(entries: ScoreEntry[], sort: MarketplaceSort, q: string | undefined): ScoreEntry[] {
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
  }

  private compareUpdatedAt(left: MarketplaceItem, right: MarketplaceItem): number {
    const leftTs = Date.parse(left.updatedAt);
    const rightTs = Date.parse(right.updatedAt);

    if (Number.isNaN(leftTs) || Number.isNaN(rightTs)) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }

    return rightTs - leftTs;
  }

  private selectSection(snapshot: MarketplaceCatalogSnapshot, type: MarketplaceItemType): MarketplaceCatalogSection {
    return type === "plugin" ? snapshot.plugins : snapshot.skills;
  }

  private selectScene(section: MarketplaceCatalogSection, sceneId?: string) {
    if (!sceneId) {
      return section.recommendations[0] ?? {
        id: "default",
        title: "Recommendations",
        itemIds: []
      };
    }

    return (
      section.recommendations.find((scene) => scene.id === sceneId) ?? {
        id: sceneId,
        title: sceneId,
        itemIds: []
      }
    );
  }

  private toSummary(item: MarketplaceItem): MarketplaceItemSummary {
    return {
      id: item.id,
      slug: item.slug,
      type: item.type,
      name: item.name,
      summary: item.summary,
      tags: item.tags,
      author: item.author,
      install: item.install,
      updatedAt: item.updatedAt
    };
  }
}
