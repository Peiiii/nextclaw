import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import {
  DEFAULT_MARKETPLACE_READ_API_BASES,
  DOMESTIC_MARKETPLACE_API_BASE,
  DEFAULT_MARKETPLACE_API_BASE
} from "@nextclaw-server/features/marketplace/index.js";

const MARKETPLACE_FETCH_TIMEOUT_MS = 12_000;
const DOMESTIC_MARKETPLACE_FETCH_TIMEOUT_MS = 2_000;
const DOMESTIC_MARKETPLACE_RETRY_ATTEMPTS = 2;

export function resolveMarketplaceBaseUrls(options: UiRouterOptions): readonly string[] {
  const configured = options.marketplace?.apiBaseUrl?.trim();
  if (configured) {
    return [configured.replace(/\/$/, "")];
  }
  return DEFAULT_MARKETPLACE_READ_API_BASES;
}

export function normalizeMarketplaceBaseUrls(baseUrls: readonly string[] | undefined, baseUrl: string | undefined): string[] {
  const candidates = baseUrls && baseUrls.length > 0 ? baseUrls : [baseUrl ?? DEFAULT_MARKETPLACE_API_BASE];
  return [...new Set(candidates.map((candidate) => candidate.trim().replace(/\/$/, "")).filter(Boolean))];
}

export function getMarketplaceFetchOptions(baseUrl: string): {
  timeoutMs: number;
  retryAttempts: number;
} {
  if (baseUrl.replace(/\/$/, "") !== DOMESTIC_MARKETPLACE_API_BASE) {
    return {
      timeoutMs: MARKETPLACE_FETCH_TIMEOUT_MS,
      retryAttempts: 5
    };
  }
  return {
    timeoutMs: DOMESTIC_MARKETPLACE_FETCH_TIMEOUT_MS,
    retryAttempts: DOMESTIC_MARKETPLACE_RETRY_ATTEMPTS
  };
}

export function shouldFallbackMarketplaceResult(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
