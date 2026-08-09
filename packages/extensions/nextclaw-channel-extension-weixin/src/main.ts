import { startChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "./services/weixin-auth-capability.service.js";
import { toWeixinSubmittedMessage } from "./utils/weixin-submitted-message.utils.js";

await startChannelExtension({
  channelId: "weixin",
  createAdapter: async () => {
    const { WeixinChannelAdapter } = await import("./services/weixin-channel-adapter.service.js");
    return new WeixinChannelAdapter();
  },
  mapInbound: toWeixinSubmittedMessage,
  createAuthCapability: ({ channel }) => new WeixinAuthCapability({ channel }),
  onNcpEventError: warnNcpEventError("weixin"),
});
