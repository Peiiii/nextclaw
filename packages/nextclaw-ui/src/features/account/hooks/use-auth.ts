import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  fetchAuthStatus,
  loginAuth,
  logoutAuth,
  setupAuth,
  updateAuthEnabled,
  updateAuthPassword
} from '@/shared/lib/api';
import type { AuthStatusView } from '@/shared/lib/api';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
import { isTransientRuntimeConnectionErrorMessage } from '@/shared/lib/transport';

const AUTH_STATUS_BOOTSTRAP_PROBE_POLICY = {
  maxRetries: 8,
  startupTimeoutMs: 2_000,
  settledTimeoutMs: 5_000,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 3_000,
} as const;

export function isTransientAuthStatusBootstrapError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return isTransientRuntimeConnectionErrorMessage(error.message);
}

export function shouldRetryAuthStatusBootstrap(failureCount: number, error: unknown): boolean {
  if (failureCount >= AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.maxRetries) {
    return false;
  }
  return isTransientAuthStatusBootstrapError(error);
}

export function resolveAuthStatusBootstrapRetryDelay(failureCount: number): number {
  return Math.min(
    AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.retryMaxDelayMs,
    AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.retryBaseDelayMs * 2 ** Math.max(0, failureCount - 1)
  );
}

export function useAuthStatus() {
  const [bootstrapSettled, setBootstrapSettled] = useState(false);
  const query = useQuery<AuthStatusView>({
    queryKey: ['auth-status'],
    queryFn: () => fetchAuthStatus({
      timeoutMs: bootstrapSettled
        ? AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.settledTimeoutMs
        : AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.startupTimeoutMs,
    }),
    staleTime: 5_000,
    retry: shouldRetryAuthStatusBootstrap,
    retryDelay: resolveAuthStatusBootstrapRetryDelay
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
