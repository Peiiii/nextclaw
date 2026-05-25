import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { TelegramChannel } from "./services/telegram-channel.service.js";

await startBusChannelExtension<Config["channels"]["telegram"], MessageBus>({
  channelId: "telegram",
  createChannel: ({ config, bus, channel }) => new TelegramChannel(config, bus, channel.commands),
  onChannelStartError: warnNcpEventError("telegram"),
});
