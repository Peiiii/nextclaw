import type { Config, MessageBus } from "@nextclaw/core";
import { DingTalkChannel } from "@nextclaw/channel-runtime";
import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";

await startBusChannelExtension<Config["channels"]["dingtalk"], MessageBus>({
  channelId: "dingtalk",
  createChannel: ({ config, bus }) => new DingTalkChannel(config, bus),
  onChannelStartError: warnNcpEventError("dingtalk"),
});
