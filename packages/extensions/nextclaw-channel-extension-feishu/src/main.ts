import { startChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import { FeishuAuthCapability } from "./services/feishu-auth-capability.service.js";
import { toFeishuSubmittedMessage } from "./utils/feishu-submitted-message.utils.js";

await startChannelExtension({
  channelId: "feishu",
  createAdapter: async () => {
    const { FeishuChannelAdapter } = await import("./services/feishu-channel-adapter.service.js");
    return new FeishuChannelAdapter();
  },
  mapInbound: toFeishuSubmittedMessage,
  createAuthCapability: ({ channel }) => new FeishuAuthCapability({ channel }),
  onNcpEventError: warnNcpEventError("feishu"),
});
