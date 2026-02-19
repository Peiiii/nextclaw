import { resolveBuiltinChannelRuntime } from "@nextclaw/channel-runtime";

const runtime = resolveBuiltinChannelRuntime("dingtalk");

const plugin = {
  id: "builtin-channel-dingtalk",
  name: "Builtin DingTalk Channel",
  description: "Builtin NextClaw channel plugin for dingtalk",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {}
  },
  register(api) {
    api.registerChannel({
      plugin: {
        id: "dingtalk",
        nextclaw: {
          isEnabled: runtime.isEnabled,
          createChannel: runtime.createChannel
        }
      }
    });
  }
};

export default plugin;
