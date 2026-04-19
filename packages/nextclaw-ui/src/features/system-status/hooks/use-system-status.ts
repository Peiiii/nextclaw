import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBootstrapStatus } from '@/api/config';
import type { BootstrapStatusView } from '@/api/types';
import {
  toRuntimeControlPanelView,
  toRuntimeStatusBadgeView,
  toSystemStatusView,
} from '@/features/system-status/utils/system-status.utils';
import { systemStatusManager } from '@/features/system-status/managers/system-status.manager';
import { useSystemStatusStore } from '@/features/system-status/stores/system-status.store';

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

export function useSystemStatusSources() {
  const runtimeBootstrapStatus = useQuery({
    queryKey: ['runtime-bootstrap-status'],
    queryFn: fetchBootstrapStatus,
    placeholderData: createPendingBootstrapStatus,
    refetchInterval: (query) => {
      return systemStatusManager.getRuntimeBootstrapPollInterval(
        query.state.data
      );
    },
    refetchIntervalInBackground: true,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const runtimeControl = useQuery({
    queryKey: ['runtime-control'],
    queryFn: async () => await systemStatusManager.getRuntimeControl(),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
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

export function useChatRuntimeAvailability() {
  const state = useSystemStatusStore((store) => store.state);
  const view = toSystemStatusView(state);
  return {
    isBlocked: view.isChatBlocked,
    message: view.chatMessage,
    phase: view.phase,
    lastReadyAt: view.lastReadyAt,
  };
}

export function useRuntimeStatusBadgeView() {
  const state = useSystemStatusStore((store) => store.state);
  return toRuntimeStatusBadgeView(state);
}

export function useRuntimeControlPanelView() {
  const state = useSystemStatusStore((store) => store.state);
  return toRuntimeControlPanelView(state);
}
