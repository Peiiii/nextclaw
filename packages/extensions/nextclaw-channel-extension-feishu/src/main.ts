import { NextClawExtension } from "@nextclaw/extension-sdk";
import { FeishuAuthCapability } from "./services/feishu-auth-capability.service.js";
import { FeishuChannelAdapter } from "./services/feishu-channel-adapter.service.js";
import { FeishuExtensionRuntime } from "./services/feishu-extension-runtime.service.js";

const extension = new NextClawExtension();
const feishu = extension.channels.use("feishu");
const runtime = new FeishuExtensionRuntime(
  feishu,
  new FeishuChannelAdapter(),
);

extension.capabilities.provide("channel.auth", new FeishuAuthCapability({ channel: feishu }));
await runtime.start();
