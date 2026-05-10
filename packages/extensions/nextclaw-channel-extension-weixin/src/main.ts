import { NextClawExtension } from "@nextclaw/extension-sdk";
import { WeixinChannelAdapterSkeleton } from "./weixin-channel-adapter.service.js";
import { WeixinExtensionRuntime } from "./weixin-extension-runtime.service.js";

const extension = new NextClawExtension();
const runtime = new WeixinExtensionRuntime(
  extension.channels.use("weixin"),
  new WeixinChannelAdapterSkeleton(),
);

await runtime.start();
