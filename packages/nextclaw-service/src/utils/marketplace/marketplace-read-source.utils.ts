const DOMESTIC_MARKETPLACE_API_BASE = "https://api.nextclaw.net";
export const OFFICIAL_MARKETPLACE_API_BASE = "https://marketplace-api.nextclaw.io";
export const DEFAULT_MARKETPLACE_API_BASE = OFFICIAL_MARKETPLACE_API_BASE;
const DEFAULT_MARKETPLACE_READ_API_BASES = [
  DOMESTIC_MARKETPLACE_API_BASE,
  OFFICIAL_MARKETPLACE_API_BASE,
] as const;
const MARKETPLACE_FETCH_TIMEOUT_MS = 12_000;
const DOMESTIC_MARKETPLACE_FETCH_TIMEOUT_MS = 2_000;
const DOMESTIC_MARKETPLACE_RETRY_ATTEMPTS = 2;

export type MarketplaceReadResult<T> = {
  apiBase: string;
  data: T;
};

export class MarketplaceRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MarketplaceRequestError";
  }
}

export function resolveMarketplaceReadApiBases(explicitBase: string | undefined): readonly string[] {
  const raw = explicitBase?.trim() || process.env.NEXTCLAW_MARKETPLACE_API_BASE?.trim();
  if (raw) {
    return [raw.replace(/\/+$/, "")];
  }
  return DEFAULT_MARKETPLACE_READ_API_BASES;
}

export function getMarketplaceReadFetchOptions(apiBase: string): {
  timeoutMs: number;
  retryAttempts: number;
} {
  if (apiBase.replace(/\/+$/, "") !== DOMESTIC_MARKETPLACE_API_BASE) {
    return {
      timeoutMs: MARKETPLACE_FETCH_TIMEOUT_MS,
      retryAttempts: 5,
    };
  }
  return {
    timeoutMs: DOMESTIC_MARKETPLACE_FETCH_TIMEOUT_MS,
    retryAttempts: DOMESTIC_MARKETPLACE_RETRY_ATTEMPTS,
  };
}

export function shouldFallbackMarketplaceReadError(error: unknown): boolean {
  if (!(error instanceof MarketplaceRequestError)) {
    return true;
  }
  return error.status === 408 || error.status === 429 || (typeof error.status === "number" && error.status >= 500);
}

export async function runMarketplaceReadSources<T>(
  apiBases: readonly string[],
  action: (apiBase: string) => Promise<T>,
): Promise<MarketplaceReadResult<T>> {
  let lastError: unknown;
  for (const apiBase of apiBases) {
    try {
      return {
        apiBase,
        data: await action(apiBase),
      };
    } catch (error) {
      lastError = error;
      if (!shouldFallbackMarketplaceReadError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}
