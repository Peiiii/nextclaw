import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { WeComChannel } from "./services/wecom-channel.service.js";

await startBusChannelExtension<Config["channels"]["wecom"], MessageBus>({
  channelId: "wecom",
  createChannel: ({ config, bus }) => new WeComChannel(config, bus),
  onChannelStartError: warnNcpEventError("wecom"),
});
