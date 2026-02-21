import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConfig,
  fetchConfigMeta,
  fetchConfigSchema,
  updateModel,
  updateProvider,
  updateChannel,
  updateRuntime,
  executeConfigAction
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

export function useExecuteConfigAction() {
  return useMutation({
    mutationFn: ({ actionId, data }: { actionId: string; data: unknown }) =>
      executeConfigAction(actionId, data as Parameters<typeof executeConfigAction>[1]),
    onError: (error: Error) => {
      toast.error(t('error') + ': ' + error.message);
    }
  });
}
