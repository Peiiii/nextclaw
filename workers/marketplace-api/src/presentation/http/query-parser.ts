import type { Context } from "hono";
import { DomainValidationError } from "../../domain/errors";
import type {
  MarketplaceAppCatalogQuery,
  MarketplaceAppCatalogSort,
  MarketplaceListQuery,
  MarketplaceSort,
} from "../../domain/model";

const SORT_VALUES: MarketplaceSort[] = ["relevance", "updated"];
const APP_CATALOG_SORT_VALUES: MarketplaceAppCatalogSort[] = ["relevance", "featured", "updated"];
const ADMIN_SKILL_PUBLISH_STATUS_VALUES = ["pending", "published", "rejected", "all"] as const;
const ADMIN_APP_PUBLISH_STATUS_VALUES = ["pending", "published", "rejected", "all"] as const;
type MarketplaceAdminSkillPublishStatus = typeof ADMIN_SKILL_PUBLISH_STATUS_VALUES[number];
type MarketplaceAdminAppPublishStatus = typeof ADMIN_APP_PUBLISH_STATUS_VALUES[number];

export class MarketplaceQueryParser {
  parseAppCatalogQuery(c: Context): MarketplaceAppCatalogQuery {
    const query = c.req.query();
    return {
      q: this.readBoundedOptionalString(query.q, "query.q", 120),
      tag: this.readBoundedOptionalString(query.tag, "query.tag", 64)?.toLowerCase(),
      tags: this.readAppCatalogTags(query.tags),
      publisher: this.readBoundedOptionalString(query.publisher, "query.publisher", 128),
      featured: this.readOptionalBoolean(query.featured, "query.featured"),
      cursor: this.readBoundedOptionalString(query.cursor, "query.cursor", 2048),
      limit: this.readCatalogLimit(query.limit),
      sort: this.readAppCatalogSort(query.sort),
    };
  }

  parseListQuery(c: Context): MarketplaceListQuery {
    const query = c.req.query();
    const page = this.readPage(query.page);
    const pageSize = this.readPageSize(query.pageSize);
    const sort = this.readSort(query.sort);

    return {
      q: this.readOptionalString(query.q),
      tag: this.readOptionalString(query.tag),
      page,
      pageSize,
      sort
    };
  }

  parseRecommendationScene(c: Context): string | undefined {
    return this.readOptionalString(c.req.query("scene"));
  }

  parseAdminSkillListQuery(c: Context): {
    publishStatus: MarketplaceAdminSkillPublishStatus;
    q?: string;
    page: number;
    pageSize: number;
  } {
    const query = c.req.query();
    return {
      publishStatus: this.readAdminSkillPublishStatus(query.publishStatus),
      q: this.readOptionalString(query.q),
      page: this.readPage(query.page),
      pageSize: this.readPageSize(query.pageSize)
    };
  }

  parseAdminAppListQuery(c: Context): {
    publishStatus: MarketplaceAdminAppPublishStatus;
    q?: string;
    page: number;
    pageSize: number;
  } {
    const query = c.req.query();
    return {
      publishStatus: this.readAdminAppPublishStatus(query.publishStatus),
      q: this.readOptionalString(query.q),
      page: this.readPage(query.page),
      pageSize: this.readPageSize(query.pageSize),
    };
  }

  parseRecommendationLimit(c: Context): number {
    const limit = c.req.query("limit");
    if (!limit) {
      return 10;
    }

    const parsed = Number.parseInt(limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new DomainValidationError("query.limit must be a positive integer");
    }

    return Math.min(parsed, 50);
  }

  private readPage(rawPage: string | undefined): number {
    if (!rawPage) {
      return 1;
    }

    const parsed = Number.parseInt(rawPage, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new DomainValidationError("query.page must be a positive integer");
    }

    return parsed;
  }

  private readPageSize(rawPageSize: string | undefined): number {
    if (!rawPageSize) {
      return 20;
    }

    const parsed = Number.parseInt(rawPageSize, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new DomainValidationError("query.pageSize must be a positive integer");
    }

    return Math.min(parsed, 100);
  }

  private readSort(rawSort: string | undefined): MarketplaceSort {
    if (!rawSort) {
      return "relevance";
    }

    if (!SORT_VALUES.includes(rawSort as MarketplaceSort)) {
      throw new DomainValidationError("query.sort is invalid");
    }

    return rawSort as MarketplaceSort;
  }

  private readAppCatalogSort(rawSort: string | undefined): MarketplaceAppCatalogSort {
    if (!rawSort) {
      return "relevance";
    }
    if (!APP_CATALOG_SORT_VALUES.includes(rawSort as MarketplaceAppCatalogSort)) {
      throw new DomainValidationError("query.sort is invalid");
    }
    return rawSort as MarketplaceAppCatalogSort;
  }

  private readCatalogLimit(rawLimit: string | undefined): number {
    if (!rawLimit) {
      return 24;
    }
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new DomainValidationError("query.limit must be a positive integer");
    }
    return Math.min(parsed, 50);
  }

  private readOptionalBoolean(value: string | undefined, field: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    throw new DomainValidationError(`${field} must be true or false`);
  }

  private readAppCatalogTags(value: string | undefined): string[] | undefined {
    if (!value) {
      return undefined;
    }
    const tags = [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    if (tags.length === 0 || tags.length > 8 || tags.some((tag) => tag.length > 64)) {
      throw new DomainValidationError("query.tags must contain 1 to 8 comma-separated tags");
    }
    return tags;
  }

  private readBoundedOptionalString(
    value: string | undefined,
    field: string,
    maxLength: number,
  ): string | undefined {
    const normalized = this.readOptionalString(value);
    if (normalized && normalized.length > maxLength) {
      throw new DomainValidationError(`${field} must be at most ${maxLength} characters`);
    }
    return normalized;
  }

  private readAdminSkillPublishStatus(rawStatus: string | undefined): MarketplaceAdminSkillPublishStatus {
    if (!rawStatus) {
      return "pending";
    }
    if (!ADMIN_SKILL_PUBLISH_STATUS_VALUES.includes(rawStatus as MarketplaceAdminSkillPublishStatus)) {
      throw new DomainValidationError("query.publishStatus is invalid");
    }
    return rawStatus as MarketplaceAdminSkillPublishStatus;
  }

  private readAdminAppPublishStatus(rawStatus: string | undefined): MarketplaceAdminAppPublishStatus {
    if (!rawStatus) {
      return "pending";
    }
    if (!ADMIN_APP_PUBLISH_STATUS_VALUES.includes(rawStatus as MarketplaceAdminAppPublishStatus)) {
      throw new DomainValidationError("query.publishStatus is invalid");
    }
    return rawStatus as MarketplaceAdminAppPublishStatus;
  }

  private readOptionalString(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
