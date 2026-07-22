import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventKeys, type UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';

import { nextclawClient } from '@/shared/lib/api';

const SESSION_RUN_QUEUE_QUERY_KEY = 'ncp-session-run-queue';

export function useSessionRunQueue(sessionKey: string | null) {
  const queryClient = useQueryClient();
  const normalizedSessionKey = sessionKey?.trim() || null;
  const query = useQuery({
    queryKey: [SESSION_RUN_QUEUE_QUERY_KEY, normalizedSessionKey],
    queryFn: () => nextclawClient.sessions.listQueuedInputs(normalizedSessionKey as string),
    enabled: Boolean(normalizedSessionKey),
    retry: false,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!normalizedSessionKey) {
      return undefined;
    }
    return nextclawClient.eventBus.on(eventKeys.sessionRunQueueUpdated, ({ sessionKey: updatedSessionKey }) => {
      if (updatedSessionKey !== normalizedSessionKey) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: [SESSION_RUN_QUEUE_QUERY_KEY, normalizedSessionKey],
        exact: true,
      });
    });
  }, [normalizedSessionKey, queryClient]);

  const removeQueuedInput = useCallback(async (
    queuedInputId: string,
  ): Promise<UiNcpSessionQueuedInputView | null> => {
    if (!normalizedSessionKey) {
      return null;
    }
    return await nextclawClient.sessions.deleteQueuedInput(
      normalizedSessionKey,
      queuedInputId,
    );
  }, [normalizedSessionKey]);

  return {
    inputs: query.data?.inputs ?? [],
    isLoading: query.isLoading,
    removeQueuedInput,
  };
}
