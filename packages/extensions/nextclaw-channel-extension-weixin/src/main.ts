import { startChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { WeixinAuthCapability } from "./services/weixin-auth-capability.service.js";
import { WeixinChannelAdapter } from "./services/weixin-channel-adapter.service.js";
import { toWeixinSubmittedMessage } from "./utils/weixin-submitted-message.utils.js";

await startChannelExtension({
  channelId: "weixin",
  createAdapter: () => new WeixinChannelAdapter(),
  mapInbound: toWeixinSubmittedMessage,
  createAuthCapability: ({ channel }) => new WeixinAuthCapability({ channel }),
  onNcpEventError: warnNcpEventError("weixin"),
});
