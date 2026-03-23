import { API_BASE } from './api-base';
import type { ApiResponse } from './types';

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

export async function requestRawApiResponse<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

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
