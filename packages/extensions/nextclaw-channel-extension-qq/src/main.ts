import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { QQChannel, type QQChannelConfig } from "./services/qq-channel.service.js";

await startBusChannelExtension<QQChannelConfig>({
  channelId: "qq",
  createChannel: ({ config, bus }) => new QQChannel(config, bus),
  onChannelStartError: warnNcpEventError("qq"),
});
