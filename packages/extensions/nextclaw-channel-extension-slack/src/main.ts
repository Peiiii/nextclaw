import type { Config, MessageBus } from "@nextclaw/core";
import { SlackChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["slack"], MessageBus>({
  channelId: "slack",
  createChannel: ({ config, bus }) => new SlackChannel(config, bus),
  onChannelStartError: warnNcpEventError("slack"),
});
