import { useQuery } from '@tanstack/react-query';
import { fetchServerPathRead } from '@/shared/lib/api';

export function buildServerPathReadQueryKey(params: {
  path?: string | null;
  basePath?: string | null;
}) {
  return ['server-path-read', params.path?.trim() ?? '', params.basePath ?? null] as const;
}

export function useServerPathRead(params: {
  path?: string | null;
  basePath?: string | null;
  enabled?: boolean;
}) {
  const normalizedPath = params.path?.trim() ?? '';
  return useQuery({
    queryKey: buildServerPathReadQueryKey({
      path: normalizedPath,
      basePath: params.basePath,
    }),
    queryFn: () =>
      fetchServerPathRead({
        path: normalizedPath,
        basePath: params.basePath,
      }),
    enabled: (params.enabled ?? true) && normalizedPath.length > 0,
    staleTime: 0,
  });
}
