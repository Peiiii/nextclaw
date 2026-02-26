import type { Context } from "hono";
import { DomainValidationError } from "../../domain/errors";
import type { MarketplaceListQuery, MarketplaceSort } from "../../domain/model";

const SORT_VALUES: MarketplaceSort[] = ["relevance", "updated"];

export class MarketplaceQueryParser {
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

  private readOptionalString(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
