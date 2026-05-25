import { nextclawClient } from '@/shared/lib/api/managers/client.manager';
import type {
  ChannelAuthPollRequest,
  ChannelAuthPollResult,
  ChannelAuthConnectRequest,
  ChannelAuthConnectResult,
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

export async function connectChannelAuth(
  channel: string,
  data: ChannelAuthConnectRequest
): Promise<ChannelAuthConnectResult> {
  return await nextclawClient.channelAuth.connect(channel, data);
}
