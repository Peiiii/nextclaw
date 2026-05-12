import { nextclawClient } from '../managers/client.manager';
import type { ServerPathBrowseView, ServerPathReadView } from '@/shared/lib/api/types';

export async function fetchServerPathBrowse(params?: {
  path?: string | null;
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
