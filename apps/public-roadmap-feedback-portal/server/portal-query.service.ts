import {
  PUBLIC_PHASES,
  type ItemsQuery,
  type ItemsResponse,
  type PortalOverview,
  type PublicItem,
  type PublicItemDetail,
  type PublicItemType,
  type PublicPhase,
  type UpdatesResponse
} from "../shared/public-roadmap-feedback-portal.types.js";
import { PORTAL_PREVIEW_ITEMS } from "./portal-preview.config.js";

const ACTIVE_PHASES = new Set<PublicPhase>(["considering", "planned", "building", "reviewing"]);

export class PortalQueryService {
  readonly mode = "preview";
  readonly items: PublicItem[];

  constructor(items: PublicItem[] = PORTAL_PREVIEW_ITEMS) {
    this.items = items;
  }

  getOverview = (): PortalOverview => {
    const totalSignals = this.items.reduce((sum, item) => {
      return sum + item.engagement.voteCount + item.engagement.linkedFeedbackCount;
    }, 0);

    return {
      generatedAt: new Date().toISOString(),
      mode: this.mode,
      summary: {
        totalItems: this.items.length,
        activeItems: this.items.filter((item) => ACTIVE_PHASES.has(item.publicPhase)).length,
        shippedItems: this.items.filter((item) => item.publicPhase === "shipped").length,
        buildingItems: this.items.filter((item) => item.publicPhase === "building").length,
        reviewingItems: this.items.filter((item) => item.publicPhase === "reviewing").length,
        totalSignals
      },
      phaseSummary: PUBLIC_PHASES.map((phase) => ({
        phase,
        count: this.items.filter((item) => item.publicPhase === phase).length
      })),
      currentFocus: this.sortByHotness(
        this.items.filter((item) => item.publicPhase === "building" || item.publicPhase === "reviewing")
      ).slice(0, 3),
      shippedHighlights: this.getShippedItems().slice(0, 3)
    };
  };

  listItems = (query: ItemsQuery): ItemsResponse => {
    const filteredItems = this.items.filter((item) => {
      const phaseMatched = !query.phase || query.phase === "all" || item.publicPhase === query.phase;
      const typeMatched = !query.type || query.type === "all" || item.type === query.type;
      return phaseMatched && typeMatched;
    });

    const sortedItems = query.sort === "hot"
      ? this.sortByHotness(filteredItems)
      : this.sortByRecentUpdate(filteredItems);

    return {
      generatedAt: new Date().toISOString(),
      mode: this.mode,
      items: sortedItems
    };
  };

  getItemDetail = (itemId: string): PublicItemDetail => {
    const item = this.items.find((entry) => entry.id === itemId || entry.slug === itemId);
    if (!item) {
      throw new Error(`Unknown public roadmap item: ${itemId}`);
    }

    return {
      item,
      relatedItems: this.sortByHotness(
        this.items.filter((entry) => entry.id !== item.id && this.isRelated(entry, item))
      ).slice(0, 3)
    };
  };

  getUpdates = (): UpdatesResponse => {
    return {
      generatedAt: new Date().toISOString(),
      mode: this.mode,
      items: this.getShippedItems()
    };
  };

  isKnownPhase = (phase: string): phase is PublicPhase => {
    return PUBLIC_PHASES.includes(phase as PublicPhase);
  };

  isKnownType = (type: string): type is PublicItemType => {
    return ["feature", "bug", "improvement", "research"].includes(type);
  };

  private getShippedItems = (): PublicItem[] => {
    return this.items
      .filter((item) => item.publicPhase === "shipped")
      .sort((left, right) => `${right.shippedAt ?? right.updatedAt}`.localeCompare(`${left.shippedAt ?? left.updatedAt}`));
  };

  private sortByRecentUpdate = (items: PublicItem[]): PublicItem[] => {
    return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  };

  private sortByHotness = (items: PublicItem[]): PublicItem[] => {
    return [...items].sort((left, right) => {
      const rightScore = right.engagement.voteCount + right.engagement.linkedFeedbackCount * 3;
      const leftScore = left.engagement.voteCount + left.engagement.linkedFeedbackCount * 3;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  };

  private isRelated = (entry: PublicItem, item: PublicItem): boolean => {
    if (entry.type === item.type) {
      return true;
    }
    return entry.tags.some((tag) => item.tags.includes(tag));
  };
}
