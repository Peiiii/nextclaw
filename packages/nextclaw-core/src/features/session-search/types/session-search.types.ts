import type { SessionMessage } from "@core/features/session/index.js";

export const DEFAULT_SESSION_SEARCH_LIMIT = 5;
export const MAX_SESSION_SEARCH_LIMIT = 10;

export type SessionSearchSessionRecord = {
  sessionId: string;
  messages: SessionMessage[];
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type SessionSearchDocument = {
  sessionId: string;
  label: string;
  content: string;
  updatedAt: string;
};

export type SessionSearchIndexedMetadata = {
  sessionId: string;
  updatedAt: string;
  contentHash: string;
  indexedAt: string;
};

export type SessionSearchStoreQuery = {
  matchExpression: string;
  limit: number;
  excludeSessionId?: string;
};

export type SessionSearchStoreHit = SessionSearchDocument & {
  rank: number;
};

export type SessionSearchStoreResult = {
  total: number;
  hits: SessionSearchStoreHit[];
};

export type SessionSearchRequest = {
  query: string;
  limit?: number;
  currentSessionId?: string;
  includeCurrentSession?: boolean;
};

export type SessionSearchHit = {
  sessionId: string;
  label: string;
  updatedAt: string;
  snippet: string;
  matchSource: "label" | "content";
  rank: number;
};

export type SessionSearchResult = {
  query: string;
  totalHits: number;
  hits: SessionSearchHit[];
};
