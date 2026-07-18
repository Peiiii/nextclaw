import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCronJob,
  fetchCronJobs,
  runCronJob,
  setCronJobEnabled
} from '@/shared/lib/api';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
import type { CronListQuery } from '@/shared/lib/api';

export function useCronJobs(params: CronListQuery = { all: true }) {
  return useQuery({
    queryKey: ['cron', params],
    queryFn: () => fetchCronJobs(params),
    placeholderData: (previousData) => previousData,
    staleTime: 10_000
  });
}

function useCronMutationFeedback() {
  const queryClient = useQueryClient();

  return {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cron'] });
      toast.success(t('configSavedApplied'));
    },
    onError: (error: Error) => {
      toast.error(t('configSaveFailed') + ': ' + error.message);
    }
  };
}

export function useDeleteCronJob() {
  const feedback = useCronMutationFeedback();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteCronJob(id),
    ...feedback
  });
}

export function useToggleCronJob() {
  const feedback = useCronMutationFeedback();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setCronJobEnabled(id, { enabled }),
    ...feedback
  });
}

export function useRunCronJob() {
  const feedback = useCronMutationFeedback();

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => runCronJob(id, { force }),
    ...feedback
  });
}
