import { resolveBuiltinChannelRuntime } from "@nextclaw/channel-runtime";

const runtime = resolveBuiltinChannelRuntime("telegram");

const plugin = {
  id: "builtin-channel-telegram",
  name: "Builtin Telegram Channel",
  description: "Builtin NextClaw channel plugin for telegram",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {}
  },
  register(api) {
    api.registerChannel({
      plugin: {
        id: "telegram",
        nextclaw: {
          isEnabled: runtime.isEnabled,
          createChannel: runtime.createChannel
        }
      }
    });
  }
};

export default plugin;
