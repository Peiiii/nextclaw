import type { ChannelId } from "@/types/entity-ids.types.js";
import type { ChannelRecord } from "@/types/channel.types.js";

export class ChannelManager {
  readonly listChannels = () => {
    throw new Error("ChannelManager.listChannels is not implemented.");
  };

  readonly getChannel = (channelId: ChannelId) => {
    void channelId;
    throw new Error("ChannelManager.getChannel is not implemented.");
  };

  readonly requireChannel = (channelId: ChannelId) => {
    void channelId;
    throw new Error("ChannelManager.requireChannel is not implemented.");
  };

  readonly saveChannel = (channel: ChannelRecord) => {
    void channel;
    throw new Error("ChannelManager.saveChannel is not implemented.");
  };

  readonly enableChannel = (channelId: ChannelId) => {
    void channelId;
    throw new Error("ChannelManager.enableChannel is not implemented.");
  };

  readonly disableChannel = (channelId: ChannelId) => {
    void channelId;
    throw new Error("ChannelManager.disableChannel is not implemented.");
  };
}
