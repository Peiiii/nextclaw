import type { ChannelId } from "@/types/entity-ids.types.js";
import type { ChannelRecord } from "@/types/channel.types.js";

export abstract class ChannelManager {
  abstract listChannels(): ChannelRecord[];
  abstract getChannel(channelId: ChannelId): ChannelRecord | null;
  abstract requireChannel(channelId: ChannelId): ChannelRecord;
  abstract saveChannel(channel: ChannelRecord): void;
  abstract enableChannel(channelId: ChannelId): void;
  abstract disableChannel(channelId: ChannelId): void;
}
