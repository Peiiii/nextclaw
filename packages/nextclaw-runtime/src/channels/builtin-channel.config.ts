export const BUILTIN_CHANNEL_IDS = [
  "telegram",
  "whatsapp",
  "discord",
  "feishu",
  "dingtalk",
  "wecom",
  "email",
  "slack",
  "qq",
  "weixin"
] as const;

export type BuiltinChannelId = (typeof BUILTIN_CHANNEL_IDS)[number];

export function isBuiltinChannelId(value: string): value is BuiltinChannelId {
  return BUILTIN_CHANNEL_IDS.includes(value as BuiltinChannelId);
}
