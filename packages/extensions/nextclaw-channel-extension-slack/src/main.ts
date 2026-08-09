import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["slack"], MessageBus>({
  channelId: "slack",
  createChannel: async ({ config, bus }) => {
    const { SlackChannel } = await import("./services/slack-channel.service.js");
    return new SlackChannel(config, bus);
  },
  onChannelStartError: warnNcpEventError("slack"),
});
