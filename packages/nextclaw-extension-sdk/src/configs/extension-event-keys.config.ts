import { createEventKey } from "@nextclaw/shared";
import type {
  ChannelConfigChangedEvent,
  ChannelNcpEvent,
} from "../types/extension-sdk.types.js";

export const extensionEventKeys = {
  channelConfigChanged: createEventKey<ChannelConfigChangedEvent>(
    "extension.channel.config.changed",
  ),
  channelNcpEvent: createEventKey<ChannelNcpEvent>(
    "extension.channel.ncp.event",
  ),
};
