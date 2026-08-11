import { useQuery } from '@tanstack/react-query';
import { nextclawClient } from '@/shared/lib/api';

export function useSystemObjectReferences(params: {
  enabled: boolean;
  query: string;
  limit?: number;
  objectType?: string;
}) {
  const { enabled, limit, objectType } = params;
  const query = params.query.trim();
  return useQuery({
    queryKey: ['system-object-references', objectType ?? null, query, limit ?? null],
    queryFn: () => nextclawClient.systemObjectReferences.list({
      query: query || undefined,
      limit,
      objectType,
    }),
    enabled,
    staleTime: 10_000,
  });
}
