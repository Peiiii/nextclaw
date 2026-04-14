import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RuntimeControlView } from '@/api/runtime-control.types';
import { runtimeControlManager } from '@/runtime-control/runtime-control.manager';

export function useRuntimeControl() {
  return useQuery({
    queryKey: ['runtime-control'],
    queryFn: async (): Promise<RuntimeControlView> => await runtimeControlManager.getControl(),
    staleTime: 5_000,
    refetchOnWindowFocus: true
  });
}

export function useRuntimeServiceAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: 'start-service' | 'restart-service' | 'stop-service') =>
      await runtimeControlManager.controlService(action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['runtime-control'] });
    }
  });
}
