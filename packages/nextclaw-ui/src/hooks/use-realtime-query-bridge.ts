import { useEffect, useRef } from 'react';
import { applyNcpSessionRealtimeEvent } from '@/api/ncp-session-query-cache';
import { appClient } from '@/transport';
import { useUiStore } from '@/stores/ui.store';
import type { QueryClient } from '@tanstack/react-query';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';
type SetConnectionStatus = (status: ConnectionStatus) => void;

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
  queryClient: QueryClient | undefined,
  setConnectionStatus: SetConnectionStatus,
  shouldResyncSessionsRef: { current: boolean },
  event: Parameters<Parameters<typeof appClient.subscribe>[0]>[0]
): void {
  if (event.type === 'connection.open') {
    setConnectionStatus('connected');
    if (shouldResyncSessionsRef.current) {
      shouldResyncSessionsRef.current = false;
      queryClient?.invalidateQueries({ queryKey: ['ncp-sessions'] });
    }
    return;
  }
  if (event.type === 'connection.close' || event.type === 'connection.error') {
    setConnectionStatus('disconnected');
    shouldResyncSessionsRef.current = true;
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
  const { setConnectionStatus } = useUiStore();
  const shouldResyncSessionsRef = useRef(false);

  useEffect(() => {
    setConnectionStatus('connecting');

    return appClient.subscribe((event) =>
      handleRealtimeEvent(queryClient, setConnectionStatus, shouldResyncSessionsRef, event)
    );
  }, [queryClient, setConnectionStatus]);
}
