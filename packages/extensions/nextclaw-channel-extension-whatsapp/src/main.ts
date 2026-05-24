import type { Config, MessageBus } from "@nextclaw/core";
import { WhatsAppChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["whatsapp"], MessageBus>({
  channelId: "whatsapp",
  createChannel: ({ config, bus }) => new WhatsAppChannel(config, bus),
  onChannelStartError: warnNcpEventError("whatsapp"),
});
