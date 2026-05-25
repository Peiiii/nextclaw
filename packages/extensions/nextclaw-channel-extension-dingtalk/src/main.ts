import type { Config, MessageBus } from "@nextclaw/core";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { DingTalkChannel } from "./services/dingtalk-channel.service.js";

await startBusChannelExtension<Config["channels"]["dingtalk"], MessageBus>({
  channelId: "dingtalk",
  createChannel: ({ config, bus }) => new DingTalkChannel(config, bus),
  onChannelStartError: warnNcpEventError("dingtalk"),
});
