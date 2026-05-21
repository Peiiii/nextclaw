import { ExtensionChannelController, NextClawExtension } from "@nextclaw/extension-sdk";
import { FeishuAuthCapability } from "./services/feishu-auth-capability.service.js";
import { FeishuChannelAdapter } from "./services/feishu-channel-adapter.service.js";
import { toFeishuSubmittedMessage } from "./utils/feishu-submitted-message.utils.js";

const extension = new NextClawExtension();
const feishu = extension.channels.use("feishu");
const controller = new ExtensionChannelController({
  channel: feishu,
  adapter: new FeishuChannelAdapter(),
  mapInbound: toFeishuSubmittedMessage,
  onNcpEventError: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[feishu] failed to send NCP event: ${message}`);
  },
});

extension.capabilities.provide("channel.auth", new FeishuAuthCapability({ channel: feishu }));
await controller.start();
