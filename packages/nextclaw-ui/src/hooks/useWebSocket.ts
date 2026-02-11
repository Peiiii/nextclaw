import { useEffect, useState } from 'react';
import { ConfigWebSocket } from '@/api/websocket';
import { useUiStore } from '@/stores/ui.store';
import type { QueryClient } from '@tanstack/react-query';

export function useWebSocket(queryClient?: QueryClient) {
  const [ws, setWs] = useState<ConfigWebSocket | null>(null);
  const { setConnectionStatus } = useUiStore();

  useEffect(() => {
    const wsUrl = `ws://127.0.0.1:18791/ws`;
    const client = new ConfigWebSocket(wsUrl);

    client.on('connection.open', () => {
      setConnectionStatus('connected');
    });

    client.on('config.updated', () => {
      // Trigger refetch of config
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['config'] });
      }
    });

    client.on('error', (event) => {
      if (event.type === 'error') {
        console.error('WebSocket error:', event.payload.message);
      }
    });

    client.connect();
    setWs(client);

    return () => client.disconnect();
  }, [setConnectionStatus, queryClient]);

  return ws;
}
