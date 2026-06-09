import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConfig,
  fetchConfigMeta,
  fetchConfigSchema,
  fetchProviders,
  fetchProviderTemplates,
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
  executeConfigAction
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

export function useConfigMeta() {
  return useQuery({
    queryKey: ['config-meta'],
    queryFn: fetchConfigMeta,
    staleTime: Infinity
  });
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviders,
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useProviderTemplates() {
  return useQuery({
    queryKey: ['provider-templates'],
    queryFn: fetchProviderTemplates,
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
    mutationFn: ({ provider, data }: { provider: string; data: unknown; silentSuccess?: boolean }) =>
      updateProvider(provider, data as Parameters<typeof updateProvider>[1]),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      if (!variables.silentSuccess) {
        toast.success(t('configSaved'));
      }
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
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
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
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
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
