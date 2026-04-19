import type { MarketplaceListQuery } from "../../domain/model";

export class MarketplaceAppQuerySupport {
  buildFilters = (query: MarketplaceListQuery): { whereClause: string; bindings: unknown[] } => {
    const clauses: string[] = [];
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
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
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
    return "application/octet-stream";
  };

  pickLatestVersion = (currentVersion: string | undefined, candidateVersion: string): string => {
    if (!currentVersion) {
      return candidateVersion;
    }
    return this.compareSemver(candidateVersion, currentVersion) >= 0 ? candidateVersion : currentVersion;
  };

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
