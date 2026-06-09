import { useQuery } from '@tanstack/react-query';
import { fetchNcpChatSessionTypes } from '@/shared/lib/api';

export function useNcpChatSessionTypes() {
  return useQuery({
    queryKey: ['ncp-session-types'],
    queryFn: fetchNcpChatSessionTypes,
    staleTime: 10_000,
    retry: false
  });
}
