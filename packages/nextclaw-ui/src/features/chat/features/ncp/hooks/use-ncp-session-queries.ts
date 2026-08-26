import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNcpSessionObservations,
  fetchNcpSessionSkills,
  fetchNcpSessionTokenUsage,
  fetchNcpSessions,
  updateNcpSessionObservation,
} from '@/shared/lib/api';
import type {
  NcpSessionObservationAction,
  NcpSessionObservationKind,
} from '@/shared/lib/api';

const ncpSessionQueryDefaults = { staleTime: 5_000, retry: false } as const;

export function useNcpSessions(params?: { limit?: number; peerId?: string }) {
  return useQuery({
    queryKey: ['ncp-sessions', params?.limit ?? null, params?.peerId?.trim() || null],
    queryFn: () => fetchNcpSessions(params),
    ...ncpSessionQueryDefaults
  });
}

export function useInfiniteNcpSessions(params: { pageSize: number; query?: string }) {
  return useInfiniteQuery({
    queryKey: ['ncp-session-pages', params.pageSize, params.query?.trim() || null],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchNcpSessions({
      page: pageParam,
      pageSize: params.pageSize,
      ...(params.query?.trim() ? { query: params.query.trim() } : {}),
    }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? (lastPage.page ?? 1) + 1 : undefined,
    ...ncpSessionQueryDefaults,
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

export function useNcpSessionTokenUsage(sessionId: string | null) {
  return useQuery({
    queryKey: ['ncp-session-token-usage', sessionId],
    queryFn: () => fetchNcpSessionTokenUsage(sessionId as string),
    enabled: Boolean(sessionId),
    ...ncpSessionQueryDefaults
  });
}

export const ncpSessionObservationsQueryKey = (sessionId: string | null) =>
  ['ncp-session-observations', sessionId] as const;

export function useNcpSessionObservations(sessionId: string | null) {
  return useQuery({
    queryKey: ncpSessionObservationsQueryKey(sessionId),
    queryFn: () => fetchNcpSessionObservations(sessionId as string),
    enabled: Boolean(sessionId),
    ...ncpSessionQueryDefaults
  });
}

export function useNcpObservationAction(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: NcpSessionObservationKind;
      id: string;
      action: NcpSessionObservationAction;
    }) => updateNcpSessionObservation(sessionId as string, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ncpSessionObservationsQueryKey(sessionId),
      });
    },
  });
}
