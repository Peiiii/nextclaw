import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { EmailChannel } from "./services/email-channel.service.js";

await startBusChannelExtension<Config["channels"]["email"], MessageBus>({
  channelId: "email",
  createChannel: ({ config, bus }) => new EmailChannel(config, bus),
  onChannelStartError: warnNcpEventError("email"),
});
