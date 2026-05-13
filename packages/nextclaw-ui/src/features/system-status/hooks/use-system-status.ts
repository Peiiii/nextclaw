import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBootstrapStatus } from '@/shared/lib/api';
import type { BootstrapStatusView } from '@/shared/lib/api';
import {
  toRuntimeControlPanelView,
  toRuntimeStatusBadgeView,
  toSystemStatusView,
} from '@/features/system-status/utils/system-status.utils';
import { systemStatusManager } from '@/features/system-status/managers/system-status.manager';
import { useSystemStatusStore } from '@/features/system-status/stores/system-status.store';

export function useSystemStatusSources() {
  const runtimeBootstrapStatus = useQuery<BootstrapStatusView>({
    queryKey: ['runtime-bootstrap-status'],
    queryFn: () => fetchBootstrapStatus({
      timeoutMs: 5_000,
    }),
    refetchInterval: (query) => {
      return systemStatusManager.getRuntimeBootstrapPollInterval(
        query.state.data,
        query.state.fetchFailureCount
      );
    },
    retry: false,
  });
  const runtimeControl = useQuery({
    queryKey: ['runtime-control'],
    queryFn: async () => await systemStatusManager.getRuntimeControl(),
    staleTime: 5_000,
  });

  useEffect(() => {
    if (runtimeBootstrapStatus.data) {
      systemStatusManager.reportBootstrapStatus(runtimeBootstrapStatus.data);
    }
  }, [runtimeBootstrapStatus.data]);

  useEffect(() => {
    if (runtimeBootstrapStatus.error) {
      systemStatusManager.reportBootstrapQueryError(runtimeBootstrapStatus.error);
    }
  }, [runtimeBootstrapStatus.error]);

  useEffect(() => {
    if (runtimeControl.data) {
      systemStatusManager.reportRuntimeControlView(runtimeControl.data);
    }
  }, [runtimeControl.data]);

  useEffect(() => {
    if (runtimeControl.error) {
      systemStatusManager.reportRuntimeControlError(runtimeControl.error);
    }
  }, [runtimeControl.error]);
}

export function useSystemStatus() {
  const state = useSystemStatusStore((store) => store.state);
  return toSystemStatusView(state);
}

export function useRuntimeStatusBadgeView() {
  const state = useSystemStatusStore((store) => store.state);
  return toRuntimeStatusBadgeView(state);
}

export function useRuntimeControlPanelView() {
  const state = useSystemStatusStore((store) => store.state);
  return toRuntimeControlPanelView(state);
}
