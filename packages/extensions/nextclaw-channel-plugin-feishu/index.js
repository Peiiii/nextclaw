import { resolveBuiltinChannelRuntime } from "@nextclaw/channel-runtime";

const runtime = resolveBuiltinChannelRuntime("feishu");

const plugin = {
  id: "builtin-channel-feishu",
  name: "Builtin Feishu Channel",
  description: "Builtin NextClaw channel plugin for feishu",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {}
  },
  register(api) {
    api.registerChannel({
      plugin: {
        id: "feishu",
        nextclaw: {
          isEnabled: runtime.isEnabled,
          createChannel: runtime.createChannel
        }
      }
    });
  }
};

export default plugin;
