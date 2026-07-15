import { API_BASE } from '@/shared/lib/api/api-base';
import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type {
  ServerPathBrowseView,
  ServerPathDirectoryCreateRequest,
  ServerPathDirectoryCreateView,
  ServerPathReadView,
} from '@/shared/lib/api/types';

const SERVER_PATH_CONTENT_BASE_PATH = '/api/server-paths/content';

export async function fetchServerPathBrowse(params?: {
  path?: string | null;
  basePath?: string | null;
  includeFiles?: boolean;
}): Promise<ServerPathBrowseView> {
  return await nextclawClient.serverPaths.browse(params);
}

export async function createServerPathDirectory(
  input: ServerPathDirectoryCreateRequest,
): Promise<ServerPathDirectoryCreateView> {
  return await nextclawClient.serverPaths.createDirectory(input);
}

export async function fetchServerPathRead(params: {
  path: string;
  basePath?: string | null;
  line?: number | null;
}): Promise<ServerPathReadView> {
  return await nextclawClient.serverPaths.read(params);
}

export function buildServerPathContentUrl(path: string): string;
export function buildServerPathContentUrl(
  path: string,
  basePath: string | null,
): string | null;
export function buildServerPathContentUrl(
  path: string,
  basePath?: string | null,
): string | null {
  const normalizedPath = path.trim();
  const isAbsolute = normalizedPath.startsWith("/") || /^[a-z]:[\\/]/i.test(normalizedPath);
  const normalizedBasePath = basePath?.trim() ?? "";
  if (!isAbsolute && !normalizedBasePath) {
    return null;
  }
  const query = new URLSearchParams({ path: normalizedPath });
  if (normalizedBasePath) {
    query.set("basePath", normalizedBasePath);
  }
  return `${API_BASE}${SERVER_PATH_CONTENT_BASE_PATH}?${query.toString()}`;
}
