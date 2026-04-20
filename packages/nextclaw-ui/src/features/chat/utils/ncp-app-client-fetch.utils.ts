import { systemStatusManager } from '@/features/system-status';

type FetchLike = typeof fetch;

function formatFetchTarget(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function formatUnknownFetchError(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name?.trim();
    const message = error.message?.trim();
    if (name && message) {
      return `${name}: ${message}`;
    }
    return message || name || 'Unknown Error';
  }
  return String(error ?? 'Unknown error');
}

function createErrorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message) as Error & { cause?: unknown };
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

export function createNcpAppClientFetch(): FetchLike {
  return async (input, init) => {
    try {
      return await fetch(input, {
        credentials: 'include',
        ...init
      });
    } catch (error) {
      systemStatusManager.reportTransportFailure(formatUnknownFetchError(error));
      const method = (init?.method || 'GET').toUpperCase();
      const target = formatFetchTarget(input);
      throw createErrorWithCause(
        `NCP fetch failed for ${method} ${target}: ${formatUnknownFetchError(error)}`,
        error
      );
    }
  };
}
