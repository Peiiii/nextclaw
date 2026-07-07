import { API_BASE } from '@/shared/lib/api/api-base';
import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type { ServerPathBrowseView, ServerPathReadView } from '@/shared/lib/api/types';

const SERVER_PATH_CONTENT_BASE_PATH = '/api/server-paths/content';
const SERVER_PATH_CONTENT_ABSOLUTE_SCOPE = '__abs__';
const SERVER_PATH_CONTENT_WINDOWS_SCOPE = '__win__';

function encodeServerPathSegments(path: string): string {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export async function fetchServerPathBrowse(params?: {
  path?: string | null;
  basePath?: string | null;
  includeFiles?: boolean;
}): Promise<ServerPathBrowseView> {
  return await nextclawClient.serverPaths.browse(params);
}

export async function fetchServerPathRead(params: {
  path: string;
  basePath?: string | null;
}): Promise<ServerPathReadView> {
  return await nextclawClient.serverPaths.read(params);
}

export function buildServerPathContentUrl(resolvedPath: string): string {
  const normalizedPath = resolvedPath.trim();
  if (/^[a-z]:[\\/]/i.test(normalizedPath)) {
    const [drive, ...segments] = normalizedPath.replace(/\\/g, '/').split('/');
    return `${API_BASE}${SERVER_PATH_CONTENT_BASE_PATH}/${SERVER_PATH_CONTENT_WINDOWS_SCOPE}/${encodeURIComponent(drive)}/${segments
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`;
  }
  return `${API_BASE}${SERVER_PATH_CONTENT_BASE_PATH}/${SERVER_PATH_CONTENT_ABSOLUTE_SCOPE}/${encodeServerPathSegments(normalizedPath)}`;
}
