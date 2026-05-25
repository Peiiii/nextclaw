import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { SlackChannel } from "./services/slack-channel.service.js";

await startBusChannelExtension<Config["channels"]["slack"], MessageBus>({
  channelId: "slack",
  createChannel: ({ config, bus }) => new SlackChannel(config, bus),
  onChannelStartError: warnNcpEventError("slack"),
});
