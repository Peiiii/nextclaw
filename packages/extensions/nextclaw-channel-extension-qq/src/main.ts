import { QQChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

type QQChannelConfig = ConstructorParameters<typeof QQChannel>[0];
type QQChannelBus = ConstructorParameters<typeof QQChannel>[1];

await startBusChannelExtension<QQChannelConfig, QQChannelBus>({
  channelId: "qq",
  createChannel: ({ config, bus }) => new QQChannel(config, bus),
  onChannelStartError: warnNcpEventError("qq"),
});
