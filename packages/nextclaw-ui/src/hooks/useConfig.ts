import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConfig,
  fetchConfigMeta,
  fetchConfigSchema,
  updateModel,
  updateProvider,
  updateChannel,
  updateRuntime,
  updateSecrets,
  executeConfigAction,
  fetchSessions,
  fetchSessionHistory,
  updateSession,
  deleteSession,
  sendChatTurn,
  fetchCronJobs,
  deleteCronJob,
  setCronJobEnabled,
  runCronJob
} from '@/api/config';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useConfigMeta() {
  return useQuery({
    queryKey: ['config-meta'],
    queryFn: fetchConfigMeta,
    staleTime: Infinity
  });
}

export function useConfigSchema() {
  return useQuery({
    queryKey: ['config-schema'],
    queryFn: fetchConfigSchema,
    staleTime: Infinity
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateModel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: unknown }) =>
      updateProvider(provider, data as Parameters<typeof updateProvider>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: unknown }) =>
      updateChannel(channel, data as Parameters<typeof updateChannel>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateRuntime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: unknown }) =>
      updateRuntime(data as Parameters<typeof updateRuntime>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateSecrets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: unknown }) =>
      updateSecrets(data as Parameters<typeof updateSecrets>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useExecuteConfigAction() {
  return useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: unknown }) =>
      executeConfigAction(actionId, data as Parameters<typeof executeConfigAction>[1]),
    onError: (error: Error) => {
      toast.error(t('error') + ': ' + error.message);
    }
  });
}


export function useSessions(params: { q?: string; limit?: number; activeMinutes?: number }) {
  return useQuery({
    queryKey: ['sessions', params],
    queryFn: () => fetchSessions(params),
    staleTime: 10_000
  });
}

export function useSessionHistory(key: string | null, limit = 200) {
  return useQuery({
    queryKey: ['session-history', key, limit],
    queryFn: () => fetchSessionHistory(key as string, limit),
    enabled: Boolean(key),
    staleTime: 5_000
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: Parameters<typeof updateSession>[1] }) =>
      updateSession(key, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session-history', variables.key] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key }: { key: string }) => deleteSession(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session-history'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useSendChatTurn() {
  return useMutation({
    mutationFn: ({ data }: { data: Parameters<typeof sendChatTurn>[0] }) =>
      sendChatTurn(data),
    onError: (error: Error) => {
      toast.error(t('chatSendFailed') + ': ' + error.message);
    }
  });
}

export function useCronJobs(params: { all?: boolean } = { all: true }) {
  return useQuery({
    queryKey: ['cron', params],
    queryFn: () => fetchCronJobs(params),
    staleTime: 10_000
  });
}

export function useDeleteCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteCronJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useToggleCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setCronJobEnabled(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useRunCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => runCronJob(id, { force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}
