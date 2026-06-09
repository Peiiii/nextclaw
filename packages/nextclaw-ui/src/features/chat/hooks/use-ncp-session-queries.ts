import { useQuery } from '@tanstack/react-query';
import {
  fetchNcpSessionSkills,
  fetchNcpSessions
} from '@/shared/lib/api';

const ncpSessionQueryDefaults = { staleTime: 5_000, retry: false } as const;

export function useNcpSessions(params?: { limit?: number; peerId?: string }) {
  return useQuery({
    queryKey: ['ncp-sessions', params?.limit ?? null, params?.peerId?.trim() || null],
    queryFn: () => fetchNcpSessions(params),
    ...ncpSessionQueryDefaults
  });
}

export function useNcpSessionSkills(params: {
  sessionId: string | null;
  projectRoot?: string | null;
}) {
  return useQuery({
    queryKey: ['ncp-session-skills', params.sessionId, params.projectRoot ?? null],
    queryFn: () =>
      fetchNcpSessionSkills(params.sessionId as string, {
        ...(Object.prototype.hasOwnProperty.call(params, 'projectRoot')
          ? { projectRoot: params.projectRoot ?? null }
          : {})
    }),
    enabled: Boolean(params.sessionId),
    ...ncpSessionQueryDefaults
  });
}
