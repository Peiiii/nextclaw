import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  fetchAuthStatus,
  loginAuth,
  logoutAuth,
  setupAuth,
  updateAuthEnabled,
  updateAuthPassword
} from '@/api/config';
import type { AuthStatusView } from '@/api/types';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

const AUTH_STATUS_BOOTSTRAP_MAX_RETRIES = 40;
const AUTH_STATUS_BOOTSTRAP_TIMEOUT_MS = 400;
export const AUTH_STATUS_BOOTSTRAP_RETRY_DELAY_MS = 250;

export function isTransientAuthStatusBootstrapError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.trim().toLowerCase();
  if (!message) {
    return false;
  }
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('request timed out') ||
    message.includes('timed out waiting for remote request response') ||
    message.includes('remote transport connection closed')
  );
}

export function shouldRetryAuthStatusBootstrap(failureCount: number, error: unknown): boolean {
  if (failureCount >= AUTH_STATUS_BOOTSTRAP_MAX_RETRIES) {
    return false;
  }
  return isTransientAuthStatusBootstrapError(error);
}

export function useAuthStatus() {
  const [bootstrapSettled, setBootstrapSettled] = useState(false);
  const query = useQuery<AuthStatusView>({
    queryKey: ['auth-status'],
    queryFn: () => fetchAuthStatus({ timeoutMs: bootstrapSettled ? 5_000 : AUTH_STATUS_BOOTSTRAP_TIMEOUT_MS }),
    staleTime: 5_000,
    retry: shouldRetryAuthStatusBootstrap,
    retryDelay: AUTH_STATUS_BOOTSTRAP_RETRY_DELAY_MS,
    refetchOnWindowFocus: true
  });

  useEffect(() => {
    if (query.isSuccess && !bootstrapSettled) {
      setBootstrapSettled(true);
    }
  }, [bootstrapSettled, query.isSuccess]);

  return query;
}

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
