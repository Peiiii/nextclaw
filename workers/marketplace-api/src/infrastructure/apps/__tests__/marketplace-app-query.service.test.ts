import { describe, expect, it } from "vitest";
import { MarketplaceAppQuerySupport } from "../marketplace-app-query.service";
import type { MarketplaceAppCatalogQuery } from "@/domain/model";

describe("MarketplaceAppQuerySupport", () => {
  it("serves marketplace artwork with browser image content types", () => {
    const support = new MarketplaceAppQuerySupport();

    expect(support.resolveContentType("marketplace-assets/cover.webp")).toBe("image/webp");
    expect(support.resolveContentType("marketplace-assets/cover.avif")).toBe("image/avif");
    expect(support.resolveContentType("marketplace-assets/cover.png")).toBe("image/png");
    expect(support.resolveContentType("marketplace-assets/cover.jpg")).toBe("image/jpeg");
  });

  it("builds escaped prefix search terms for latin and CJK queries", () => {
    const support = new MarketplaceAppQuerySupport();

    expect(support.buildCatalogSearchExpression("Hello Notes")).toBe(
      '"hello"* AND "notes"*',
    );
    expect(support.buildCatalogSearchExpression("个人 笔记")).toBe(
      '"个人"* AND "笔记"*',
    );
    expect(() => support.buildCatalogSearchExpression("---")).toThrow(
      "query.q must contain searchable text",
    );
  });

  it("keeps cursors opaque and bound to the originating query", () => {
    const support = new MarketplaceAppQuerySupport();
    const query = buildCatalogQuery({ q: "notes" });
    const cursor = support.encodeCatalogCursor(query, {
      id: "app-notes",
      updated_at: "2026-08-13T00:00:00.000Z",
      featured: 1,
      relevance: -2.5,
    });

    expect(support.decodeCatalogCursor(cursor, query)).toMatchObject({
      id: "app-notes",
      relevance: -2.5,
      sort: "relevance",
    });
    expect(() => support.decodeCatalogCursor(cursor, buildCatalogQuery({ q: "calendar" })))
      .toThrow("query.cursor does not match this catalog query");
    expect(() => support.decodeCatalogCursor(`${cursor}broken`, query))
      .toThrow("query.cursor is invalid");
  });

  it("normalizes relevance without a query to the featured catalog order", () => {
    const support = new MarketplaceAppQuerySupport();
    expect(support.resolveCatalogSort(buildCatalogQuery())).toBe("featured");
  });
});

function buildCatalogQuery(
  overrides: Partial<MarketplaceAppCatalogQuery> = {},
): MarketplaceAppCatalogQuery {
  return {
    limit: 24,
    sort: "relevance",
    ...overrides,
  };
}
