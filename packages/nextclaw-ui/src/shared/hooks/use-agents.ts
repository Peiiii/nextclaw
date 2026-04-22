import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAgent, deleteAgent, fetchAgents, updateAgent } from '@/shared/lib/api';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    staleTime: 30_000
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data }: { data: Parameters<typeof createAgent>[0] }) => createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: Parameters<typeof updateAgent>[1] }) =>
      updateAgent(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId }: { agentId: string }) => deleteAgent(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  });
}
