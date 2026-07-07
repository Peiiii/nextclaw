import { useQuery } from '@tanstack/react-query';
import { fetchServerPathBrowse } from '@/shared/lib/api';

export function buildServerPathBrowseQueryKey(params: {
  path?: string | null;
  basePath?: string | null;
  includeFiles?: boolean;
}) {
  return [
    'server-path-browse',
    params.path?.trim() ?? '',
    params.basePath?.trim() ?? '',
    params.includeFiles ?? false,
  ] as const;
}

export function useServerPathBrowse(params: {
  path?: string | null;
  basePath?: string | null;
  includeFiles?: boolean;
  enabled?: boolean;
}) {
  const { basePath, enabled, includeFiles, path } = params;
  const normalizedPath = path?.trim() ?? '';
  const normalizedBasePath = basePath?.trim() ?? '';
  return useQuery({
    queryKey: buildServerPathBrowseQueryKey({
      path: normalizedPath,
      basePath: normalizedBasePath,
      includeFiles,
    }),
    queryFn: () =>
      fetchServerPathBrowse({
        path: normalizedPath,
        basePath: normalizedBasePath,
        includeFiles,
      }),
    enabled: enabled ?? true,
    staleTime: 0,
  });
}
