import { NextClawExtension } from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "./services/weixin-auth-capability.service.js";
import { WeixinChannelAdapter } from "./services/weixin-channel-adapter.service.js";
import { WeixinExtensionRuntime } from "./services/weixin-extension-runtime.service.js";

const extension = new NextClawExtension();
const weixin = extension.channels.use("weixin");
const runtime = new WeixinExtensionRuntime(
  weixin,
  new WeixinChannelAdapter(),
);

extension.capabilities.provide("channel.auth", new WeixinAuthCapability({ channel: weixin }));
await runtime.start();
