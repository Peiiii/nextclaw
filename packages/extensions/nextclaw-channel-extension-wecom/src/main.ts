import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["wecom"], MessageBus>({
  channelId: "wecom",
  createChannel: async ({ config, bus }) => {
    const { WeComChannel } = await import("./services/wecom-channel.service.js");
    return new WeComChannel(config, bus);
  },
  onChannelStartError: warnNcpEventError("wecom"),
});
