import type { Config, MessageBus } from "@nextclaw/core";
import { WeComChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["wecom"], MessageBus>({
  channelId: "wecom",
  createChannel: ({ config, bus }) => new WeComChannel(config, bus),
  onChannelStartError: warnNcpEventError("wecom"),
});
