import { useQuery } from '@tanstack/react-query';
import { fetchBootstrapStatus } from '@/api/config';
import type { BootstrapStatusView } from '@/api/types';

const BOOTSTRAP_STATUS_POLL_INTERVAL_MS = 500;

function createPendingBootstrapStatus(): BootstrapStatusView {
  return {
    phase: 'kernel-starting',
    ncpAgent: {
      state: 'pending',
    },
    pluginHydration: {
      state: 'pending',
      loadedPluginCount: 0,
      totalPluginCount: 0,
    },
    channels: {
      state: 'pending',
      enabled: [],
    },
    remote: {
      state: 'pending',
    },
  };
}

export function resolveBootstrapStatusPollInterval(
  status: BootstrapStatusView | null | undefined
): number | false {
  if (status?.ncpAgent.state === 'ready') {
    return false;
  }
  return BOOTSTRAP_STATUS_POLL_INTERVAL_MS;
}

export function useRuntimeBootstrapStatus() {
  return useQuery({
    queryKey: ['runtime-bootstrap-status'],
    queryFn: fetchBootstrapStatus,
    placeholderData: createPendingBootstrapStatus,
    refetchInterval: (query) => {
      const status = query.state.data;
      return resolveBootstrapStatusPollInterval(status);
    },
    refetchIntervalInBackground: true,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
