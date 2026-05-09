import { normalizeString } from "../nextclaw-ncp-message-bridge.js";
import type { SessionSearchStoreService } from "./session-search-store.service.js";
import {
  DEFAULT_SESSION_SEARCH_LIMIT,
  MAX_SESSION_SEARCH_LIMIT,
  type SessionSearchHit,
  type SessionSearchRequest,
  type SessionSearchResult,
  type SessionSearchStoreHit,
} from "./session-search.types.js";

const SNIPPET_RADIUS = 80;
const MAX_FULL_SNIPPET_LENGTH = 180;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function sanitizeSearchToken(value: string): string {
  return value.replace(/["*]/gu, " ").replace(/\s+/gu, " ").trim();
}

function tokenizeSearchTerms(query: string): string[] {
  return normalizeWhitespace(query)
    .split(" ")
    .map(sanitizeSearchToken)
    .filter((token) => token.length > 0);
}

function buildMatchExpression(query: string): string {
  const terms = tokenizeSearchTerms(query);
  const searchableTerms = terms.length > 0 ? terms : [sanitizeSearchToken(query)];
  const normalizedTerms = searchableTerms.filter((term) => term.length > 0);
  if (normalizedTerms.length === 0) {
    throw new Error("query must contain searchable text.");
  }
  return normalizedTerms
    .map((term) => `"${term.replace(/"/gu, "\"\"")}"*`)
    .join(" AND ");
}

function findFirstMatchIndex(text: string, terms: string[]): number {
  const lowerText = text.toLowerCase();
  let earliestIndex = -1;
  for (const term of terms) {
    const index = lowerText.indexOf(term.toLowerCase());
    if (index < 0) {
      continue;
    }
    if (earliestIndex < 0 || index < earliestIndex) {
      earliestIndex = index;
    }
  }
  return earliestIndex;
}

function buildSnippet(text: string, terms: string[]): string {
  const normalizedText = normalizeWhitespace(text);
  if (normalizedText.length <= MAX_FULL_SNIPPET_LENGTH) {
    return normalizedText;
  }

  const matchIndex = findFirstMatchIndex(normalizedText, terms);
  if (matchIndex < 0) {
    return `${normalizedText.slice(0, MAX_FULL_SNIPPET_LENGTH).trimEnd()}...`;
  }

  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(normalizedText.length, matchIndex + SNIPPET_RADIUS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";
  return `${prefix}${normalizedText.slice(start, end).trim()}${suffix}`;
}

function resolveMatchSource(hit: SessionSearchStoreHit, terms: string[]): "label" | "content" {
  return findFirstMatchIndex(hit.label, terms) >= 0 ? "label" : "content";
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_SESSION_SEARCH_LIMIT;
  }
  const roundedLimit = Math.trunc(limit);
  if (roundedLimit <= 0) {
    return DEFAULT_SESSION_SEARCH_LIMIT;
  }
  return Math.min(roundedLimit, MAX_SESSION_SEARCH_LIMIT);
}

export class SessionSearchQueryService {
  constructor(private readonly store: SessionSearchStoreService) {}

  search = async (request: SessionSearchRequest): Promise<SessionSearchResult> => {
    const query = normalizeString(request.query);
    if (!query) {
      throw new Error("query must be a non-empty string.");
    }

    const terms = tokenizeSearchTerms(query);
    const matchExpression = buildMatchExpression(query);
    const excludeSessionId =
      request.includeCurrentSession === true
        ? undefined
        : normalizeString(request.currentSessionId) ?? undefined;
    const result = await this.store.searchDocuments({
      matchExpression,
      limit: normalizeLimit(request.limit),
      excludeSessionId,
    });

    return {
      query,
      totalHits: result.total,
      hits: result.hits.map((hit) => this.toSearchHit(hit, terms)),
    };
  };

  private toSearchHit(hit: SessionSearchStoreHit, terms: string[]): SessionSearchHit {
    const matchSource = resolveMatchSource(hit, terms);
    const label = normalizeWhitespace(hit.label) || hit.sessionId;
    const snippetSource = matchSource === "label" ? label : hit.content;

    return {
      sessionId: hit.sessionId,
      label,
      updatedAt: hit.updatedAt,
      snippet: buildSnippet(snippetSource, terms),
      matchSource,
      rank: hit.rank,
    };
  }
}
