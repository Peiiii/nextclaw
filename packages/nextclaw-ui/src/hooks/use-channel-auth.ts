import { useMutation } from '@tanstack/react-query';
import { pollChannelAuth, startChannelAuth } from '@/api/channel-auth';

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
