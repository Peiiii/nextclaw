import type { Config, MessageBus, SessionManager } from "@nextclaw/core";
import { DingTalkChannel } from "./channels/dingtalk.js";
import { DiscordChannel } from "./channels/discord.js";
import { EmailChannel } from "./channels/email.js";
import { QQChannel } from "./channels/qq.service.js";
import { SlackChannel } from "./channels/slack.js";
import { TelegramChannel } from "./channels/telegram.js";
import { WeComChannel } from "./channels/wecom.js";
import { WhatsAppChannel } from "./channels/whatsapp.js";

type BuiltinChannelCreateContext = {
  config: Config;
  bus: MessageBus;
  sessionManager?: SessionManager;
};

export type BuiltinChannelRuntime = {
  id: BuiltinChannelId;
  isEnabled: (config: Config) => boolean;
  createChannel: (context: BuiltinChannelCreateContext) => unknown;
};

const BUILTIN_CHANNEL_RUNTIMES = {
  telegram: {
    id: "telegram",
    isEnabled: (config: Config) => config.channels.telegram.enabled,
    createChannel: (context: BuiltinChannelCreateContext) => {
      const providers = context.config.providers as Record<string, { apiKey?: string } | undefined>;
      const groqApiKey = providers.groq?.apiKey;
      return new TelegramChannel(
        context.config.channels.telegram,
        context.bus,
        groqApiKey,
        context.sessionManager,
      );
    },
  },
  whatsapp: {
    id: "whatsapp",
    isEnabled: (config: Config) => config.channels.whatsapp.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new WhatsAppChannel(context.config.channels.whatsapp, context.bus),
  },
  discord: {
    id: "discord",
    isEnabled: (config: Config) => config.channels.discord.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new DiscordChannel(context.config.channels.discord, context.bus, context.sessionManager, context.config),
  },
  dingtalk: {
    id: "dingtalk",
    isEnabled: (config: Config) => config.channels.dingtalk.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new DingTalkChannel(context.config.channels.dingtalk, context.bus),
  },
  wecom: {
    id: "wecom",
    isEnabled: (config: Config) => config.channels.wecom.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new WeComChannel(context.config.channels.wecom, context.bus),
  },
  email: {
    id: "email",
    isEnabled: (config: Config) => config.channels.email.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new EmailChannel(context.config.channels.email, context.bus),
  },
  slack: {
    id: "slack",
    isEnabled: (config: Config) => config.channels.slack.enabled,
    createChannel: (context: BuiltinChannelCreateContext) =>
      new SlackChannel(context.config.channels.slack, context.bus),
  },
} as const;

export type BuiltinChannelId = keyof typeof BUILTIN_CHANNEL_RUNTIMES;

export const BUILTIN_CHANNEL_PLUGIN_IDS: BuiltinChannelId[] =
  Object.keys(BUILTIN_CHANNEL_RUNTIMES) as BuiltinChannelId[];

export function listBuiltinChannelRuntimes(): BuiltinChannelRuntime[] {
  return BUILTIN_CHANNEL_PLUGIN_IDS.map((channelId) =>
    resolveBuiltinChannelRuntime(channelId),
  );
}

export function resolveBuiltinChannelRuntime(
  channelId: string,
): BuiltinChannelRuntime {
  const runtime = (
    BUILTIN_CHANNEL_RUNTIMES as Record<string, BuiltinChannelRuntime>
  )[channelId];
  if (!runtime) {
    throw new Error(`builtin channel runtime not found: ${channelId}`);
  }
  return runtime;
}

export {
  DingTalkChannel,
  DiscordChannel,
  EmailChannel,
  QQChannel,
  SlackChannel,
  TelegramChannel,
  WeComChannel,
  WhatsAppChannel,
};
