import type { ParsedResourceUri } from '@/shared/lib/resource-uri/types/resource-uri.types';

function normalizePathSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function parseResourceUri(uri: string): ParsedResourceUri {
  const raw = uri.trim();
  try {
    const parsed = new URL(raw);
    return {
      authority: parsed.hostname,
      pathSegments: normalizePathSegments(parsed.pathname),
      pathname: parsed.pathname,
      raw,
      scheme: parsed.protocol.replace(/:$/, '').toLowerCase(),
      searchParams: parsed.searchParams,
    };
  } catch {
    return {
      authority: '',
      pathSegments: normalizePathSegments(raw),
      pathname: raw,
      raw,
      scheme: '',
      searchParams: new URLSearchParams(),
    };
  }
}

export function isResourceUriScheme(uri: ParsedResourceUri, scheme: string): boolean {
  return uri.scheme === scheme.toLowerCase();
}

export function normalizeResourcePath(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, '');
  if (!normalized) {
    return null;
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment.trim().length === 0 || segment === '.' || segment === '..')) {
    return null;
  }
  return segments.join('/');
}
