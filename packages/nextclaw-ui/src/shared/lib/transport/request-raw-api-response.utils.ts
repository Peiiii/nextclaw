import type { ApiResponse } from '@nextclaw/server';
import { systemStatusManager } from '@/features/system-status';

function compactSnippet(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function inferNonJsonHint(endpoint: string, status: number): string | undefined {
  if (
    status === 404 &&
    endpoint.startsWith('/api/config/providers/') &&
    endpoint.endsWith('/test')
  ) {
    return 'Provider test endpoint is missing. This usually means nextclaw runtime version is outdated.';
  }
  if (status === 401 || status === 403) {
    return 'Authentication failed. Check apiKey and custom headers.';
  }
  if (status === 429) {
    return 'Rate limited by upstream provider. Retry later or switch model/provider.';
  }
  if (status >= 500) {
    return 'Upstream service error. Retry later and inspect server logs if it persists.';
  }
  return undefined;
}

function formatUnknownFetchError(error: unknown): {
  summary: string;
  details: Record<string, unknown>;
} {
  if (error instanceof Error) {
    const name = error.name?.trim() || 'Error';
    const message = error.message?.trim() || 'Unknown error';
    return {
      summary: `${name}: ${message}`,
      details: {
        errorName: name,
        errorMessage: message,
        ...(error.stack?.trim() ? { errorStack: error.stack.trim() } : {})
      }
    };
  }
  return {
    summary: String(error ?? 'Unknown error'),
    details: {
      errorName: 'NonError',
      errorMessage: String(error ?? 'Unknown error')
    }
  };
}

export async function requestRawApiResponse<T>(
  apiBase: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${apiBase}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  let response: Response;
  try {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    response = await fetch(url, {
      credentials: 'include',
      headers,
      ...options
    });
  } catch (error) {
    const formatted = formatUnknownFetchError(error);
    systemStatusManager.reportTransportFailure(formatted.summary);
    return {
      ok: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Fetch failed on ${method} ${endpoint} | ${formatted.summary}`,
        details: {
          method,
          endpoint,
          url,
          ...formatted.details
        }
      }
    };
  }

  const text = await response.text();
  let data: ApiResponse<T> | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as ApiResponse<T>;
    } catch {
      // fall through to build a synthetic error response
    }
  }

  if (!data) {
    const snippet = text ? compactSnippet(text) : '';
    const hint = inferNonJsonHint(endpoint, response.status);
    const parts = [`Non-JSON response (${response.status} ${response.statusText}) on ${method} ${endpoint}`];
    if (snippet) {
      parts.push(`body=${snippet}`);
    }
    if (hint) {
      parts.push(`hint=${hint}`);
    }
    return {
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: parts.join(' | '),
        details: {
          status: response.status,
          statusText: response.statusText,
          method,
          endpoint,
          url,
          bodySnippet: snippet || undefined,
          hint
        }
      }
    };
  }

  if (!response.ok) {
    return data as ApiResponse<T>;
  }

  return data as ApiResponse<T>;
}
