import type { Config, MessageBus } from "@nextclaw/core";
import { EmailChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["email"], MessageBus>({
  channelId: "email",
  createChannel: ({ config, bus }) => new EmailChannel(config, bus),
  onChannelStartError: warnNcpEventError("email"),
});
