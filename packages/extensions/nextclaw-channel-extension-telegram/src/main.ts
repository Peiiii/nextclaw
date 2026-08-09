import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["telegram"], MessageBus>({
  channelId: "telegram",
  createChannel: async ({ config, bus, channel }) => {
    const { TelegramChannel } = await import("./services/telegram-channel.service.js");
    return new TelegramChannel(config, bus, channel.commands);
  },
  onChannelStartError: warnNcpEventError("telegram"),
});
