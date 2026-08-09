import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["discord"], MessageBus>({
  channelId: "discord",
  createChannel: async ({ config, bus, channel }) => {
    const { DiscordChannel } = await import("./services/discord-channel.service.js");
    return new DiscordChannel(config, bus, channel.commands);
  },
  onChannelStartError: warnNcpEventError("discord"),
});
