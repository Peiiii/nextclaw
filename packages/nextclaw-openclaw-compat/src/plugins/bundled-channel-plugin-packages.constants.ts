export const BUNDLED_CHANNEL_PLUGIN_PACKAGES = [
  "@nextclaw/channel-plugin-telegram",
  "@nextclaw/channel-plugin-whatsapp",
  "@nextclaw/channel-plugin-discord",
  // Legacy Feishu plugin is intentionally not bundled while the QR-first
  // Feishu channel extension owns the built-in `feishu` runtime path.
  // "@nextclaw/channel-plugin-feishu",
  "@nextclaw/channel-plugin-mochat",
  "@nextclaw/channel-plugin-dingtalk",
  "@nextclaw/channel-plugin-wecom",
  "@nextclaw/channel-plugin-email",
  "@nextclaw/channel-plugin-slack",
  "@nextclaw/channel-plugin-qq",
] as const;
