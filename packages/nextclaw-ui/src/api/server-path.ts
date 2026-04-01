import { api } from './client';
import type { ServerPathBrowseView } from './types';

export async function fetchServerPathBrowse(params?: {
  path?: string | null;
  includeFiles?: boolean;
}): Promise<ServerPathBrowseView> {
  const query = new URLSearchParams();
  if (typeof params?.path === 'string' && params.path.trim().length > 0) {
    query.set('path', params.path.trim());
  }
  if (params?.includeFiles) {
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
