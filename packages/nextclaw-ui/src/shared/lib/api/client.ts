import { appClient } from '@/shared/lib/transport';
import type { ApiResponse } from './types';

export async function requestApiResponse<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  try {
    const data = await appClient.request<T>({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: endpoint,
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      ...(options.body !== undefined ? { body: parseRequestBody(options.body) } : {})
    });
    return {
      ok: true,
      data
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'REQUEST_FAILED',
        message: error instanceof Error ? error.message : String(error),
        details: {
          method,
          endpoint
        }
      }
    };
  }
}

export const api = {
  get: <T>(path: string, options: RequestInit & { timeoutMs?: number } = {}) =>
    requestApiResponse<T>(path, { ...options, method: 'GET' }),
  put: <T>(path: string, body: unknown) =>
    requestApiResponse<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),
  post: <T>(path: string, body: unknown) =>
    requestApiResponse<T>(path, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  delete: <T>(path: string) =>
    requestApiResponse<T>(path, {
      method: 'DELETE'
    })
};

function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}
