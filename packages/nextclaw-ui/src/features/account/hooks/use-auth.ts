import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  loginAuth,
  logoutAuth,
  setupAuth,
  updateAuthEnabled,
  updateAuthPassword
} from '@/shared/lib/api';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
export {
  isTransientAuthStatusBootstrapError,
  resolveAuthStatusBootstrapRetryDelay,
  shouldRetryAuthStatusBootstrap,
  useAuthStatus,
} from "@/shared/hooks/use-auth-status";

function invalidateProtectedQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['auth-status'] }),
    queryClient.invalidateQueries({ queryKey: ['app-meta'] }),
    queryClient.invalidateQueries({ queryKey: ['config'] }),
    queryClient.invalidateQueries({ queryKey: ['config-meta'] }),
    queryClient.invalidateQueries({ queryKey: ['config-schema'] }),
    queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    queryClient.invalidateQueries({ queryKey: ['session-history'] }),
    queryClient.invalidateQueries({ queryKey: ['chat-runs'] }),
    queryClient.invalidateQueries({ queryKey: ['cron-jobs'] })
  ]);
}

export function useSetupAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setupAuth,
    onSuccess: async () => {
      await invalidateProtectedQueries(queryClient);
      toast.success(t('authSetupSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('authActionFailed')}: ${error.message}`);
    }
  });
}

export function useLoginAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginAuth,
    onSuccess: async () => {
      await invalidateProtectedQueries(queryClient);
      toast.success(t('authLoginSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('authActionFailed')}: ${error.message}`);
    }
  });
}

export function useLogoutAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutAuth,
    onSuccess: async () => {
      await invalidateProtectedQueries(queryClient);
      toast.success(t('authLogoutSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('authActionFailed')}: ${error.message}`);
    }
  });
}

export function useUpdateAuthPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAuthPassword,
    onSuccess: async () => {
      await invalidateProtectedQueries(queryClient);
      toast.success(t('authPasswordUpdated'));
    },
    onError: (error: Error) => {
      toast.error(`${t('authActionFailed')}: ${error.message}`);
    }
  });
}

export function useUpdateAuthEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAuthEnabled,
    onSuccess: async (_, variables) => {
      await invalidateProtectedQueries(queryClient);
      toast.success(variables.enabled ? t('authEnabledSuccess') : t('authDisabledSuccess'));
    },
    onError: (error: Error) => {
      toast.error(`${t('authActionFailed')}: ${error.message}`);
    }
  });
}
