import { NextClawExtension } from "@nextclaw/extension-sdk";
import { WeixinChannelAdapter } from "./weixin-channel-adapter.service.js";
import { WeixinExtensionRuntime } from "./weixin-extension-runtime.service.js";

const extension = new NextClawExtension();
const runtime = new WeixinExtensionRuntime(
  extension.channels.use("weixin"),
  new WeixinChannelAdapter(),
);

await runtime.start();
