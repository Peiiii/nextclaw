import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchConfig, fetchConfigMeta, updateModel, updateProvider, updateChannel, updateUiConfig, reloadConfig } from '@/api/config';
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
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateUiConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUiConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSaved'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useReloadConfig() {
  return useMutation({
    mutationFn: reloadConfig,
    onSuccess: () => {
      toast.success(t('configReloaded'));
    },
    onError: (error: Error) => {
      toast.error(t('configReloadFailed') + ': ' + error.message);
    }
  });
}
