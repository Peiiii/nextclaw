import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["whatsapp"], MessageBus>({
  channelId: "whatsapp",
  createChannel: async ({ config, bus }) => {
    const { WhatsAppChannel } = await import("./services/whatsapp-channel.service.js");
    return new WhatsAppChannel(config, bus);
  },
  onChannelStartError: warnNcpEventError("whatsapp"),
});
