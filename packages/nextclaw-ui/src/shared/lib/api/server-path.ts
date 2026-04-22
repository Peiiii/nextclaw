import { api } from './client';
import type { ServerPathBrowseView, ServerPathReadView } from './types';

export async function fetchServerPathBrowse(params?: {
  path?: string | null;
  includeFiles?: boolean;
}): Promise<ServerPathBrowseView> {
  const path = typeof params?.path === 'string' ? params.path.trim() : '';
  const includeFiles = Boolean(params?.includeFiles);
  const query = new URLSearchParams();
  if (path) {
    query.set('path', path);
  }
  if (includeFiles) {
    query.set('includeFiles', '1');
  }
  const suffix = query.toString();
  const response = await api.get<ServerPathBrowseView>(
    suffix ? `/api/server-paths/browse?${suffix}` : '/api/server-paths/browse'
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function fetchServerPathRead(params: {
  path: string;
  basePath?: string | null;
}): Promise<ServerPathReadView> {
  const { path } = params;
  const basePath =
    typeof params.basePath === 'string' ? params.basePath.trim() : '';
  const query = new URLSearchParams();
  query.set('path', path.trim());
  if (basePath) {
    query.set('basePath', basePath);
  }
  const response = await api.get<ServerPathReadView>(
    `/api/server-paths/read?${query.toString()}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
