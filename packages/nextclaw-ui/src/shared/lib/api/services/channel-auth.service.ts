import { nextclawClient } from './client.service';
import type {
  ChannelAuthPollRequest,
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from '@/shared/lib/api/channel-auth.types';

export async function startChannelAuth(
  channel: string,
  data: ChannelAuthStartRequest = {}
): Promise<ChannelAuthStartResult> {
  return await nextclawClient.channelAuth.start(channel, data);
}

export async function pollChannelAuth(
  channel: string,
  data: ChannelAuthPollRequest
): Promise<ChannelAuthPollResult> {
  return await nextclawClient.channelAuth.poll(channel, data);
}
