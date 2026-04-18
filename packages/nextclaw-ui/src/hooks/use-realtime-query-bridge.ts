import { useEffect, useRef } from 'react';
import { applyNcpSessionRealtimeEvent } from '@/api/ncp-session-query-cache';
import { runtimeLifecycleManager } from '@/runtime-lifecycle/runtime-lifecycle.manager';
import { appClient } from '@/transport';
import type { QueryClient } from '@tanstack/react-query';

function shouldInvalidateConfigQuery(configPath: string) {
  const normalized = configPath.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (normalized.startsWith('plugins') || normalized.startsWith('skills')) {
    return false;
  }
  return true;
}

function invalidateMarketplaceQueries(queryClient: QueryClient | undefined, configPath: string): void {
  if (configPath.startsWith('plugins')) {
    queryClient?.invalidateQueries({ queryKey: ['ncp-session-types'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-installed', 'plugin'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-items'] });
  }
  if (configPath.startsWith('mcp')) {
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-installed'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-items'] });
    queryClient?.invalidateQueries({ queryKey: ['marketplace-mcp-doctor'] });
  }
}

function handleConfigUpdatedEvent(queryClient: QueryClient | undefined, path: string): void {
  if (queryClient && shouldInvalidateConfigQuery(path)) {
    queryClient.invalidateQueries({ queryKey: ['config'] });
  }
  invalidateMarketplaceQueries(queryClient, path);
}

function handleRealtimeEvent(
  params: {
    queryClient: QueryClient | undefined;
    shouldResyncSessions: boolean;
    clearShouldResyncSessions: () => void;
    markShouldResyncSessions: () => void;
    event: Parameters<Parameters<typeof appClient.subscribe>[0]>[0];
  }
): void {
  const {
    queryClient,
    shouldResyncSessions,
    clearShouldResyncSessions,
    markShouldResyncSessions,
    event,
  } = params;
  if (event.type === 'connection.open') {
    runtimeLifecycleManager.handleConnectionRestored();
    if (shouldResyncSessions) {
      clearShouldResyncSessions();
      queryClient?.invalidateQueries({ queryKey: ['ncp-sessions'] });
    }
    return;
  }
  if (event.type === 'connection.close' || event.type === 'connection.error') {
    runtimeLifecycleManager.handleConnectionInterrupted(
      event.type === 'connection.error' ? event.payload?.message : null
    );
    markShouldResyncSessions();
    return;
  }
  if (event.type === 'config.updated') {
    const configPath = typeof event.payload?.path === 'string' ? event.payload.path : '';
    handleConfigUpdatedEvent(queryClient, configPath);
    return;
  }
  if (
    event.type === 'session.run-status' ||
    event.type === 'session.summary.upsert' ||
    event.type === 'session.summary.delete'
  ) {
    applyNcpSessionRealtimeEvent(queryClient, event);
    return;
  }
  if (event.type === 'error') {
    console.error('Realtime transport error:', event.payload.message);
  }
}

export function useRealtimeQueryBridge(queryClient?: QueryClient) {
  const shouldResyncSessionsRef = useRef(false);

  useEffect(() => {
    return appClient.subscribe((event) =>
      handleRealtimeEvent({
        queryClient,
        shouldResyncSessions: shouldResyncSessionsRef.current,
        clearShouldResyncSessions: () => {
          shouldResyncSessionsRef.current = false;
        },
        markShouldResyncSessions: () => {
          shouldResyncSessionsRef.current = true;
        },
        event,
      })
    );
  }, [queryClient]);
}
