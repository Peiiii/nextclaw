import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { nextclawClient } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export const APP_DATA_QUERY_KEY = ['app-data'] as const;

export function useAppData() {
  return useQuery({
    queryKey: APP_DATA_QUERY_KEY,
    queryFn: () => nextclawClient.appData.list(),
    staleTime: 0,
  });
}

export function useDeleteRetainedAppData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dataId, confirmAppId }: { dataId: string; confirmAppId: string }) =>
      nextclawClient.appData.deleteRetained(dataId, confirmAppId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: APP_DATA_QUERY_KEY });
      toast.success(t('appDataDeleteCompleted'));
    },
  });
}
