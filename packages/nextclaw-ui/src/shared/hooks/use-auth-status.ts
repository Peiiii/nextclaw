import { useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { fetchAuthStatus, type AuthStatusView } from "@/shared/lib/api";
import { isTransientRuntimeConnectionErrorMessage } from "@/shared/lib/transport";

const AUTH_STATUS_BOOTSTRAP_PROBE_POLICY = {
  maxRetries: 8,
  startupTimeoutMs: 2_000,
  settledTimeoutMs: 5_000,
  retryBaseDelayMs: 500,
  retryMaxDelayMs: 3_000,
} as const;

export function isTransientAuthStatusBootstrapError(error: unknown): boolean {
  return error instanceof Error && isTransientRuntimeConnectionErrorMessage(error.message);
}

export function shouldRetryAuthStatusBootstrap(failureCount: number, error: unknown): boolean {
  return failureCount < AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.maxRetries &&
    isTransientAuthStatusBootstrapError(error);
}

export function resolveAuthStatusBootstrapRetryDelay(failureCount: number): number {
  return Math.min(
    AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.retryMaxDelayMs,
    AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.retryBaseDelayMs * 2 ** Math.max(0, failureCount - 1),
  );
}

export function useAuthStatus() {
  const bootstrapSettled = useRef(false);
  const query = useQuery<AuthStatusView>({
    queryKey: ["auth-status"],
    queryFn: async () => {
      const status = await fetchAuthStatus({
        timeoutMs: bootstrapSettled.current
        ? AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.settledTimeoutMs
        : AUTH_STATUS_BOOTSTRAP_PROBE_POLICY.startupTimeoutMs,
      });
      bootstrapSettled.current = true;
      return status;
    },
    staleTime: 5_000,
    retry: shouldRetryAuthStatusBootstrap,
    retryDelay: resolveAuthStatusBootstrapRetryDelay,
  });

  return query;
}
