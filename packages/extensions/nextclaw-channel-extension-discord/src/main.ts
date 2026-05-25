import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { DiscordChannel } from "./services/discord-channel.service.js";

await startBusChannelExtension<Config["channels"]["discord"], MessageBus>({
  channelId: "discord",
  createChannel: ({ config, bus, channel }) => new DiscordChannel(config, bus, channel.commands),
  onChannelStartError: warnNcpEventError("discord"),
});
