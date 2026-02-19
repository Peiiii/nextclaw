import { resolveBuiltinChannelRuntime } from "@nextclaw/channel-runtime";

const runtime = resolveBuiltinChannelRuntime("email");

const plugin = {
  id: "builtin-channel-email",
  name: "Builtin Email Channel",
  description: "Builtin NextClaw channel plugin for email",
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {}
  },
  register(api) {
    api.registerChannel({
      plugin: {
        id: "email",
        nextclaw: {
          isEnabled: runtime.isEnabled,
          createChannel: runtime.createChannel
        }
      }
    });
  }
};

export default plugin;
