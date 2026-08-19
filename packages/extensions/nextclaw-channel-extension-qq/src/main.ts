import { startBusChannelExtension, warnNcpEventError } from "@nextclaw/extension-sdk";
import type { QQChannelConfig } from "./services/qq-channel.service.js";

await startBusChannelExtension<QQChannelConfig>({
  channelId: "qq",
  createChannel: async ({ config, bus, diagnostics }) => {
    const { QQChannel } = await import("./services/qq-channel.service.js");
    return new QQChannel(config, bus, diagnostics);
  },
  onChannelStartError: warnNcpEventError("qq"),
});
