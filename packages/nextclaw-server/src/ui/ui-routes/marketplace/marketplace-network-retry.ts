const MARKETPLACE_NETWORK_RETRY_ATTEMPTS = 5;
const MARKETPLACE_NETWORK_RETRY_BASE_MS = 350;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableMarketplaceNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "AbortError") {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && cause !== null && "code" in cause) {
    const code = (cause as { code?: unknown }).code;
    if (
      code === "ECONNRESET"
      || code === "ECONNREFUSED"
      || code === "ETIMEDOUT"
      || code === "EPIPE"
      || code === "ENOTFOUND"
      || code === "EAI_AGAIN"
    ) {
      return true;
    }
  }

  if (error instanceof TypeError && error.message === "fetch failed") {
    return true;
  }
  return false;
}

export async function runWithMarketplaceNetworkRetry<T>(action: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MARKETPLACE_NETWORK_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt === MARKETPLACE_NETWORK_RETRY_ATTEMPTS || !isRetryableMarketplaceNetworkError(error)) {
        throw error;
      }
      await sleepMs(MARKETPLACE_NETWORK_RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
