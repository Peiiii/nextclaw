import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["dingtalk"], MessageBus>({
  channelId: "dingtalk",
  createChannel: async ({ config, bus }) => {
    const { DingTalkChannel } = await import("./services/dingtalk-channel.service.js");
    return new DingTalkChannel(config, bus);
  },
  onChannelStartError: warnNcpEventError("dingtalk"),
});
