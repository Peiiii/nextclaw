import { api } from './client';
import type {
  ChannelAuthPollRequest,
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from './channel-auth.types';

export async function startChannelAuth(
  channel: string,
  data: ChannelAuthStartRequest = {}
): Promise<ChannelAuthStartResult> {
  const response = await api.post<ChannelAuthStartResult>(
    `/api/config/channels/${channel}/auth/start`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export async function pollChannelAuth(
  channel: string,
  data: ChannelAuthPollRequest
): Promise<ChannelAuthPollResult> {
  const response = await api.post<ChannelAuthPollResult>(
    `/api/config/channels/${channel}/auth/poll`,
    data
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
