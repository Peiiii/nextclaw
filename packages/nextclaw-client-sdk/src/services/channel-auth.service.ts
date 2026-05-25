import type {
  ChannelAuthPollRequest,
  ChannelAuthPollResult,
  ChannelAuthConnectRequest,
  ChannelAuthConnectResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from "@nextclaw/server";
import type { RequestService } from "./request.service.js";

export class ChannelAuthService {
  constructor(private readonly requestService: RequestService) {}

  readonly start = async (channel: string, data: ChannelAuthStartRequest = {}): Promise<ChannelAuthStartResult> => {
    return await this.requestService.post<ChannelAuthStartResult>(
      `/api/config/channels/${encodeURIComponent(channel)}/auth/start`,
      data
    );
  };

  readonly poll = async (channel: string, data: ChannelAuthPollRequest): Promise<ChannelAuthPollResult> => {
    return await this.requestService.post<ChannelAuthPollResult>(
      `/api/config/channels/${encodeURIComponent(channel)}/auth/poll`,
      data
    );
  };

  readonly connect = async (channel: string, data: ChannelAuthConnectRequest): Promise<ChannelAuthConnectResult> => {
    return await this.requestService.post<ChannelAuthConnectResult>(
      `/api/config/channels/${encodeURIComponent(channel)}/auth/connect`,
      data
    );
  };
}
