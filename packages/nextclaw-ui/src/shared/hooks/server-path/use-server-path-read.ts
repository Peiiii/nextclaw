import { useQuery } from '@tanstack/react-query';
import { fetchServerPathRead } from '@/api/server-path';

export function useServerPathRead(params: {
  path?: string | null;
  basePath?: string | null;
  enabled?: boolean;
}) {
  const normalizedPath = params.path?.trim() ?? '';
  return useQuery({
    queryKey: ['server-path-read', normalizedPath, params.basePath ?? null],
    queryFn: () =>
      fetchServerPathRead({
        path: normalizedPath,
        basePath: params.basePath,
      }),
    enabled: (params.enabled ?? true) && normalizedPath.length > 0,
    staleTime: 0,
  });
}
