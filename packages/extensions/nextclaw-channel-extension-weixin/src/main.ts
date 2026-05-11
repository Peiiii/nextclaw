import { NextClawExtension, type ExtensionChannel, type ExtensionRequest } from "@nextclaw/extension-sdk";
import { WeixinLoginService } from "./services/weixin-login.service.js";
import { WeixinChannelAdapter } from "./services/weixin-channel-adapter.service.js";
import { WeixinExtensionRuntime } from "./services/weixin-extension-runtime.service.js";

const extension = new NextClawExtension();
const weixin = extension.channels.use("weixin");
const loginService = new WeixinLoginService();
const runtime = new WeixinExtensionRuntime(
  weixin,
  new WeixinChannelAdapter(),
);

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readCurrentConfig(channel: ExtensionChannel): Promise<Record<string, unknown>> {
  const config = await channel.config.get();
  return config && typeof config === "object" && !Array.isArray(config)
    ? config as Record<string, unknown>
    : {};
}

extension.onRequest(async (request: ExtensionRequest) => {
  const payload = request.payload ?? {};
  if (readString(payload.channelId) !== "weixin") {
    throw new Error(`unsupported weixin extension request channel: ${String(payload.channelId)}`);
  }
  if (request.kind === "channel.auth.start") {
    return await loginService.start({
      pluginConfig: await readCurrentConfig(weixin),
      requestedAccountId: readString(payload.accountId),
      baseUrl: readString(payload.baseUrl),
    });
  }
  if (request.kind === "channel.auth.poll") {
    const sessionId = readString(payload.sessionId);
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    return await loginService.poll({ sessionId });
  }
  if (request.kind === "channel.auth.login") {
    return await loginService.login({
      pluginConfig: await readCurrentConfig(weixin),
      requestedAccountId: readString(payload.accountId),
      baseUrl: readString(payload.baseUrl),
      verbose: payload.verbose === true,
    });
  }
  throw new Error(`unsupported weixin extension request kind: ${request.kind}`);
});

await runtime.start();
