import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["email"], MessageBus>({
  channelId: "email",
  createChannel: async ({ config, bus }) => {
    const { EmailChannel } = await import("./services/email-channel.service.js");
    return new EmailChannel(config, bus);
  },
  onChannelStartError: warnNcpEventError("email"),
});
