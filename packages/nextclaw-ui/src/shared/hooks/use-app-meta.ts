import { useQuery } from '@tanstack/react-query';
import { fetchAppMeta } from '@/shared/lib/api';

export function useAppMeta() {
  return useQuery({
    queryKey: ['app-meta'],
    queryFn: fetchAppMeta,
    staleTime: Infinity
  });
}
