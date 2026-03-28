export const BUILTIN_CHANNEL_PLUGIN_IDS = [
  "telegram",
  "whatsapp",
  "discord",
  "feishu",
  "mochat",
  "dingtalk",
  "wecom",
  "email",
  "slack",
  "qq",
  "weixin"
] as const;

export type BuiltinChannelPluginId = (typeof BUILTIN_CHANNEL_PLUGIN_IDS)[number];

export function isBuiltinChannelPluginId(value: string): value is BuiltinChannelPluginId {
  return BUILTIN_CHANNEL_PLUGIN_IDS.includes(value as BuiltinChannelPluginId);
}
