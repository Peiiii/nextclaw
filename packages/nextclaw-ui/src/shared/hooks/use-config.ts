import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteNcpSessionSummaryInQueryClient,
  upsertNcpSessionSummaryInQueryClient
} from '@/shared/lib/api';
import {
  fetchAppMeta,
  fetchConfig,
  fetchConfigMeta,
  fetchConfigSchema,
  updateModel,
  updateSearch,
  createProvider,
  deleteProvider,
  updateProvider,
  testProviderConnection,
  startProviderAuth,
  pollProviderAuth,
  importProviderAuthFromCli,
  updateChannel,
  updateRuntime,
  updateSecrets,
  executeConfigAction,
  fetchCronJobs,
  deleteCronJob,
  setCronJobEnabled,
  runCronJob
} from '@/shared/lib/api';
import {
  deleteNcpSession,
  fetchNcpSessionMessages,
  fetchNcpSessionSkills,
  fetchNcpSessions,
  updateNcpSession
} from '@/shared/lib/api';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useAppMeta() {
  return useQuery({
    queryKey: ['app-meta'],
    queryFn: fetchAppMeta,
    staleTime: Infinity
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

export function useUpdateSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: Parameters<typeof updateSearch>[0] }) => updateSearch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(t('configSavedApplied'));
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
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useCreateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data?: unknown }) =>
      createProvider((data ?? {}) as Parameters<typeof createProvider>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider }: { provider: string }) => deleteProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useTestProviderConnection() {
  return useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: unknown }) =>
      testProviderConnection(provider, data as Parameters<typeof testProviderConnection>[1])
  });
}

export function useStartProviderAuth() {
  return useMutation({
    mutationFn: ({ provider, data }: { provider: string; data?: unknown }) =>
      startProviderAuth(provider, data as Parameters<typeof startProviderAuth>[1])
  });
}

export function usePollProviderAuth() {
  return useMutation({
    mutationFn: ({ provider, data }: { provider: string; data: unknown }) =>
      pollProviderAuth(provider, data as Parameters<typeof pollProviderAuth>[1])
  });
}

export function useImportProviderAuthFromCli() {
  return useMutation({
    mutationFn: ({ provider }: { provider: string }) => importProviderAuthFromCli(provider)
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: unknown }) =>
      updateChannel(channel, data as Parameters<typeof updateChannel>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['config-meta'] });
      toast.success(t('configSavedApplying'));
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

export function useNcpSessions(params?: { limit?: number }) {
  return useQuery({
    queryKey: ['ncp-sessions', params?.limit ?? null],
    queryFn: () => fetchNcpSessions(params),
    staleTime: 5_000,
    retry: false
  });
}

export function useNcpSessionMessages(sessionId: string | null, limit = 200) {
  return useQuery({
    queryKey: ['ncp-session-messages', sessionId, limit],
    queryFn: () => fetchNcpSessionMessages(sessionId as string, limit),
    enabled: Boolean(sessionId),
    staleTime: 5_000,
    retry: false
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
    staleTime: 5_000,
    retry: false
  });
}

export function useDeleteNcpSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId }: { sessionId: string }) => deleteNcpSession(sessionId),
    onSuccess: (_data, variables) => {
      deleteNcpSessionSummaryInQueryClient(queryClient, variables.sessionId);
      queryClient.removeQueries({ queryKey: ['ncp-session-messages', variables.sessionId] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateNcpSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: Parameters<typeof updateNcpSession>[1] }) =>
      updateNcpSession(sessionId, data),
    onSuccess: (data) => {
      upsertNcpSessionSummaryInQueryClient(queryClient, data);
      queryClient.invalidateQueries({ queryKey: ['ncp-session-skills', data.sessionId] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
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
