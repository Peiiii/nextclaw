import { useMutation } from '@tanstack/react-query';
import { connectChannelAuth, pollChannelAuth, startChannelAuth } from '@/shared/lib/api';

export function useStartChannelAuth() {
  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data?: unknown }) =>
      startChannelAuth(channel, data as Parameters<typeof startChannelAuth>[1])
  });
}

export function usePollChannelAuth() {
  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: unknown }) =>
      pollChannelAuth(channel, data as Parameters<typeof pollChannelAuth>[1])
  });
}

export function useConnectChannelAuth() {
  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: unknown }) =>
      connectChannelAuth(channel, data as Parameters<typeof connectChannelAuth>[1])
  });
}
