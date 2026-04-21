import { useQuery } from '@tanstack/react-query';
import { fetchNcpChatSessionTypes } from '@/api/config';

export function useNcpChatSessionTypes() {
  return useQuery({
    queryKey: ['ncp-session-types'],
    queryFn: fetchNcpChatSessionTypes,
    staleTime: 10_000,
    retry: false
  });
}
