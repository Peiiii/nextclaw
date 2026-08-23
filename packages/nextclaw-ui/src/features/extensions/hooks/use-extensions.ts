import { useQuery } from '@tanstack/react-query';
import { fetchExtensionCatalog } from '@/shared/lib/api';

export function useExtensions() {
  return useQuery({
    queryKey: ['extension-catalog'],
    queryFn: fetchExtensionCatalog,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
