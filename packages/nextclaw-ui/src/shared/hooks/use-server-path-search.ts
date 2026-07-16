import { useQuery } from '@tanstack/react-query';
import { fetchServerPathSearch } from '@/shared/lib/api';

export function buildServerPathSearchQueryKey(params: {
  basePath: string;
  query?: string | null;
  limit?: number | null;
}) {
  return [
    'server-path-search',
    params.basePath.trim(),
    params.query?.trim() ?? '',
    params.limit ?? null,
  ] as const;
}

export function useServerPathSearch(params: {
  basePath: string;
  query?: string | null;
  limit?: number | null;
  enabled?: boolean;
}) {
  const { enabled, limit } = params;
  const basePath = params.basePath.trim();
  const query = params.query?.trim() ?? '';
  return useQuery({
    queryKey: buildServerPathSearchQueryKey({
      basePath,
      query,
      limit,
    }),
    queryFn: () => fetchServerPathSearch({
      basePath,
      query,
      limit,
    }),
    enabled: (enabled ?? true) && Boolean(basePath),
    staleTime: 5_000,
  });
}
