import type { Config } from "../../config/schema.js";

export const BUILTIN_CHANNEL_PLUGIN_IDS = [
  "telegram",
  "whatsapp",
  "discord",
  "feishu",
  "mochat",
  "dingtalk",
  "email",
  "slack",
  "qq",
] as const;

export function isBuiltinChannelPluginId(
  value: string,
): value is keyof Config["channels"] {
  return BUILTIN_CHANNEL_PLUGIN_IDS.includes(
    value as (typeof BUILTIN_CHANNEL_PLUGIN_IDS)[number],
  );
}
