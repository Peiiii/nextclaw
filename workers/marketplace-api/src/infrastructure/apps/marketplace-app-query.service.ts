import { DomainValidationError } from "../../domain/errors";
import type {
  MarketplaceAppCatalogQuery,
  MarketplaceAppCatalogSort,
  MarketplaceListQuery,
} from "../../domain/model";

type MarketplaceAppCatalogCursor = {
  version: 1;
  fingerprint: string;
  sort: "relevance" | "featured" | "updated";
  id: string;
  updatedAt: string;
  relevance?: number;
  featured?: number;
};

export class MarketplaceAppQuerySupport {
  resolveCatalogSort = (query: MarketplaceAppCatalogQuery): MarketplaceAppCatalogSort =>
    query.sort === "relevance" && !query.q ? "featured" : query.sort;

  buildCatalogSearchExpression = (query: string): string => {
    const tokens = query
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}](?:[\p{L}\p{N}_-]*[\p{L}\p{N}])?/gu)
      ?.slice(0, 12) ?? [];
    if (tokens.length === 0) {
      throw new DomainValidationError("query.q must contain searchable text");
    }
    return tokens
      .map((token) => `"${token.replace(/"/g, '""')}"*`)
      .join(" AND ");
  };

  decodeCatalogCursor = (
    rawCursor: string | undefined,
    query: MarketplaceAppCatalogQuery,
  ): MarketplaceAppCatalogCursor | undefined => {
    if (!rawCursor) {
      return undefined;
    }
    let candidate: unknown;
    try {
      const base64 = rawCursor.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      candidate = JSON.parse(new TextDecoder().decode(
        Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
      )) as unknown;
    } catch {
      throw new DomainValidationError("query.cursor is invalid");
    }
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new DomainValidationError("query.cursor is invalid");
    }
    const cursor = candidate as Partial<MarketplaceAppCatalogCursor>;
    const sort = this.resolveCatalogSort(query);
    if (
      cursor.version !== 1 ||
      cursor.fingerprint !== this.catalogFingerprint(query) ||
      cursor.sort !== sort ||
      typeof cursor.id !== "string" ||
      typeof cursor.updatedAt !== "string" ||
      (sort === "relevance" && typeof cursor.relevance !== "number") ||
      (sort === "featured" && typeof cursor.featured !== "number")
    ) {
      throw new DomainValidationError("query.cursor does not match this catalog query");
    }
    return cursor as MarketplaceAppCatalogCursor;
  };

  encodeCatalogCursor = (
    query: MarketplaceAppCatalogQuery,
    row: { id: string; updated_at: string; featured: number; relevance?: number },
  ): string => {
    const sort = this.resolveCatalogSort(query);
    const cursor: MarketplaceAppCatalogCursor = {
      version: 1,
      fingerprint: this.catalogFingerprint(query),
      sort,
      id: row.id,
      updatedAt: row.updated_at,
      ...(sort === "featured" ? { featured: row.featured } : {}),
      ...(sort === "relevance" ? { relevance: row.relevance } : {}),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(cursor));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  };

  buildPublicFilters = (query: MarketplaceListQuery): { whereClause: string; bindings: unknown[] } => {
    const clauses: string[] = [
      "publish_status = 'published'",
      "owner_visibility = 'public'",
      "owner_deleted_at IS NULL",
    ];
    const bindings: unknown[] = [];
    if (query.q) {
      const like = `%${query.q.toLowerCase()}%`;
      clauses.push(
        "(LOWER(slug) LIKE ? OR LOWER(app_id) LIKE ? OR LOWER(name) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)",
      );
      bindings.push(like, like, like, like, like);
    }
    if (query.tag) {
      clauses.push("LOWER(tags) LIKE ?");
      bindings.push(`%"${query.tag.toLowerCase()}"%`);
    }
    return {
      whereClause: `WHERE ${clauses.join(" AND ")}`,
      bindings,
    };
  };

  resolveContentType = (filePath: string): string => {
    const normalized = filePath.toLowerCase();
    if (normalized.endsWith(".md")) {
      return "text/markdown; charset=utf-8";
    }
    if (normalized.endsWith(".json")) {
      return "application/json; charset=utf-8";
    }
    if (normalized.endsWith(".html")) {
      return "text/html; charset=utf-8";
    }
    if (normalized.endsWith(".js")) {
      return "text/javascript; charset=utf-8";
    }
    if (normalized.endsWith(".css")) {
      return "text/css; charset=utf-8";
    }
    if (normalized.endsWith(".svg")) {
      return "image/svg+xml; charset=utf-8";
    }
    if (normalized.endsWith(".webp")) {
      return "image/webp";
    }
    if (normalized.endsWith(".avif")) {
      return "image/avif";
    }
    if (normalized.endsWith(".png")) {
      return "image/png";
    }
    if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    return "application/octet-stream";
  };

  pickLatestVersion = (currentVersion: string | undefined, candidateVersion: string): string => {
    if (!currentVersion) {
      return candidateVersion;
    }
    return this.compareSemver(candidateVersion, currentVersion) >= 0 ? candidateVersion : currentVersion;
  };

  private catalogFingerprint = (query: MarketplaceAppCatalogQuery): string => JSON.stringify({
    q: query.q?.normalize("NFKC").toLowerCase() ?? "",
    tag: query.tag?.toLowerCase() ?? "",
    tags: query.tags?.map((tag) => tag.toLowerCase()).sort() ?? [],
    publisher: query.publisher ?? "",
    featured: query.featured ?? null,
    sort: this.resolveCatalogSort(query),
  });

  private compareSemver = (left: string, right: string): number => {
    const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
    const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
    const maxLength = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLength; index += 1) {
      const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] ?? 0 : 0;
      const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] ?? 0 : 0;
      if (leftValue > rightValue) {
        return 1;
      }
      if (leftValue < rightValue) {
        return -1;
      }
    }
    return 0;
  };
}
