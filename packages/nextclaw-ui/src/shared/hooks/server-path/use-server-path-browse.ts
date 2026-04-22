import { useQuery } from '@tanstack/react-query';
import { fetchServerPathBrowse } from '@/shared/lib/api';

export function useServerPathBrowse(params: {
  path?: string | null;
  includeFiles?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['server-path-browse', params.path ?? null, params.includeFiles ?? false],
    queryFn: () =>
      fetchServerPathBrowse({
        path: params.path,
        includeFiles: params.includeFiles,
      }),
    enabled: params.enabled ?? true,
    staleTime: 0,
  });
}
