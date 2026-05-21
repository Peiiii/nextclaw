import {
  ExtensionChannelController,
  NextClawExtension,
} from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "./services/weixin-auth-capability.service.js";
import { WeixinChannelAdapter } from "./services/weixin-channel-adapter.service.js";
import { toWeixinSubmittedMessage } from "./utils/weixin-submitted-message.utils.js";

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const extension = new NextClawExtension();
const weixin = extension.channels.use("weixin");
const adapter = new WeixinChannelAdapter();
const controller = new ExtensionChannelController({
  channel: weixin,
  adapter,
  mapInbound: toWeixinSubmittedMessage,
  onNcpEventError: (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[weixin] failed to send NCP event: ${message}`);
  },
});

extension.capabilities.provide("channel.auth", new WeixinAuthCapability({ channel: weixin }));
extension.capabilities.provideHandler("channel.outbound.sendText", async (payload) =>
  await controller.sendOutboundText({
    to: readRequiredString(payload.to, "to"),
    text: readRequiredString(payload.text, "text"),
    accountId: readOptionalString(payload.accountId),
  }),
);
await controller.start();
