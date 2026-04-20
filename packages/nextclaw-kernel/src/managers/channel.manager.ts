import type { ChannelId } from "@/types/entity-ids.types.js";
import type { ChannelRecord } from "@/types/channel.types.js";

export class ChannelManager {
  readonly listChannels = () => {
    // TODO(kernel): return the current channel registry snapshot.
    throw new Error("ChannelManager.listChannels is not implemented.");
  };

  readonly getChannel = (channelId: ChannelId) => {
    // TODO(kernel): look up a channel by id.
    void channelId;
    throw new Error("ChannelManager.getChannel is not implemented.");
  };

  readonly requireChannel = (channelId: ChannelId) => {
    // TODO(kernel): resolve a channel and throw a domain error when missing.
    void channelId;
    throw new Error("ChannelManager.requireChannel is not implemented.");
  };

  readonly saveChannel = (channel: ChannelRecord) => {
    // TODO(kernel): persist channel state and reconcile runtime wiring.
    void channel;
    throw new Error("ChannelManager.saveChannel is not implemented.");
  };

  readonly enableChannel = (channelId: ChannelId) => {
    // TODO(kernel): enable a channel runtime.
    void channelId;
    throw new Error("ChannelManager.enableChannel is not implemented.");
  };

  readonly disableChannel = (channelId: ChannelId) => {
    // TODO(kernel): disable a channel runtime.
    void channelId;
    throw new Error("ChannelManager.disableChannel is not implemented.");
  };
}
