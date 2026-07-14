import { useQuery } from '@tanstack/react-query';
import { fetchServerPathRead } from '@/shared/lib/api';

export function buildServerPathReadQueryKey(params: {
  path?: string | null;
  basePath?: string | null;
  line?: number | null;
}) {
  return ['server-path-read', params.path?.trim() ?? '', params.basePath ?? null, params.line ?? null] as const;
}

export function useServerPathRead(params: {
  path?: string | null;
  basePath?: string | null;
  line?: number | null;
  enabled?: boolean;
}) {
  const { basePath, enabled = true, line, path } = params;
  const normalizedPath = path?.trim() ?? '';
  return useQuery({
    queryKey: buildServerPathReadQueryKey({
      path: normalizedPath,
      basePath,
      line,
    }),
    queryFn: () =>
      fetchServerPathRead({
        path: normalizedPath,
        basePath,
        line,
      }),
    enabled: enabled && normalizedPath.length > 0,
    staleTime: 0,
  });
}
