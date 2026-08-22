import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eventKeys,
  type UiNcpSessionPendingInputView,
  type UiNcpSessionQueuedInputView,
} from '@nextclaw/client-sdk';

import { nextclawClient } from '@/shared/lib/api';

const SESSION_RUN_QUEUE_QUERY_KEY = 'ncp-session-run-queue';

export function useSessionRunQueue(sessionKey: string | null) {
  const queryClient = useQueryClient();
  const normalizedSessionKey = sessionKey?.trim() || null;
  const query = useQuery({
    queryKey: [SESSION_RUN_QUEUE_QUERY_KEY, normalizedSessionKey],
    queryFn: () => nextclawClient.sessions.listPendingInputs(normalizedSessionKey as string),
    enabled: Boolean(normalizedSessionKey),
    retry: false,
    staleTime: 5_000,
  });
  const { data, isLoading, refetch } = query;

  useEffect(() => {
    if (!normalizedSessionKey) {
      return undefined;
    }
    return nextclawClient.eventBus.on(eventKeys.sessionRunQueueUpdated, async ({ sessionKey: updatedSessionKey }) => {
      if (updatedSessionKey !== normalizedSessionKey) {
        return;
      }
      const queryKey = [SESSION_RUN_QUEUE_QUERY_KEY, normalizedSessionKey];
      await queryClient.cancelQueries({ queryKey, exact: true });
      await queryClient.invalidateQueries({ queryKey, exact: true });
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

  const refreshPendingInputs = useCallback(async (): Promise<readonly UiNcpSessionPendingInputView[]> => {
    if (!normalizedSessionKey) {
      return [];
    }
    const result = await refetch();
    return result.data?.inputs ?? [];
  }, [normalizedSessionKey, refetch]);

  const refreshQueuedInputs = useCallback(async (): Promise<readonly UiNcpSessionQueuedInputView[]> => {
    const inputs = await refreshPendingInputs();
    return inputs.filter(({ placement }) => placement === 'queued');
  }, [refreshPendingInputs]);

  const steerQueuedInput = useCallback(async (
    queuedInputId: string,
  ): Promise<UiNcpSessionPendingInputView | null> => {
    if (!normalizedSessionKey) return null;
    return await nextclawClient.sessions.steerQueuedInput(normalizedSessionKey, queuedInputId);
  }, [normalizedSessionKey]);

  const inputs = data?.inputs ?? [];

  return {
    inputs: inputs.filter(({ placement }) => placement === 'queued'),
    pendingInputs: inputs,
    isLoading,
    refreshPendingInputs,
    refreshQueuedInputs,
    removeQueuedInput,
    steerQueuedInput,
  };
}
