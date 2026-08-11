import { API_BASE } from '@/shared/lib/api/api-base';
import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type {
  ServerPathBrowseView,
  ServerPathDirectoryCreateRequest,
  ServerPathDirectoryCreateView,
  ServerPathEntryDeleteView,
  ServerPathEntryRenameRequest,
  ServerPathEntryRenameView,
  ServerPathFileCreateRequest,
  ServerPathFileCreateView,
  ServerPathFilesUploadView,
  ServerPathReadView,
  ServerPathSearchView,
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

export async function createServerPathFile(input: ServerPathFileCreateRequest): Promise<ServerPathFileCreateView> {
  return await nextclawClient.serverPaths.createFile(input);
}

export async function renameServerPathEntry(input: ServerPathEntryRenameRequest): Promise<ServerPathEntryRenameView> {
  return await nextclawClient.serverPaths.renameEntry(input);
}

export async function deleteServerPathEntry(params: {
  basePath: string;
  path: string;
}): Promise<ServerPathEntryDeleteView> {
  return await nextclawClient.serverPaths.deleteEntry(params);
}

export async function uploadServerPathFiles(params: {
  basePath: string;
  targetPath: string;
  files: readonly File[];
  overwrite?: boolean;
}): Promise<ServerPathFilesUploadView> {
  return await nextclawClient.serverPaths.uploadFiles(params);
}

export async function fetchServerPathRead(params: {
  path: string;
  basePath?: string | null;
  line?: number | null;
}): Promise<ServerPathReadView> {
  return await nextclawClient.serverPaths.read(params);
}

export async function fetchServerPathSearch(params: {
  basePath: string;
  query?: string | null;
  limit?: number | null;
}): Promise<ServerPathSearchView> {
  return await nextclawClient.serverPaths.search(params);
}

export function buildServerPathContentUrl(path: string): string;
export function buildServerPathContentUrl(path: string, basePath: string | null): string | null;
export function buildServerPathContentUrl(path: string, basePath?: string | null): string | null {
  const normalizedPath = path.trim();
  const isAbsolute = normalizedPath.startsWith('/') || /^[a-z]:[\\/]/i.test(normalizedPath);
  const normalizedBasePath = basePath?.trim() ?? '';
  if (!isAbsolute && !normalizedBasePath) {
    return null;
  }
  const query = new URLSearchParams({ path: normalizedPath });
  if (normalizedBasePath) {
    query.set('basePath', normalizedBasePath);
  }
  return `${API_BASE}${SERVER_PATH_CONTENT_BASE_PATH}?${query.toString()}`;
}
