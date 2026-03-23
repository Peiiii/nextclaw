import type { Config, MessageBus } from "@nextclaw/core";
import {
  loginWeixinChannel,
  pollWeixinLoginSession,
  startWeixinLoginSession
} from "./weixin-login.service.js";
import { WeixinChannel } from "./weixin-channel.js";
import {
  isWeixinPluginEnabled,
  normalizeWeixinPluginConfig,
  readWeixinPluginConfigFromConfig,
  WEIXIN_CHANNEL_ID,
  WEIXIN_PLUGIN_CONFIG_SCHEMA,
  WEIXIN_PLUGIN_CONFIG_UI_HINTS,
  WEIXIN_PLUGIN_ID,
} from "./weixin-config.js";

type NextclawWeixinPluginApi = {
  id: string;
  pluginConfig?: Record<string, unknown>;
  registerChannel: (registration: { plugin: Record<string, unknown> }) => void;
};

function createWeixinChannelPlugin(pluginId: string) {
  return {
    id: WEIXIN_CHANNEL_ID,
    meta: {
      id: WEIXIN_CHANNEL_ID,
      label: "Weixin",
      selectionLabel: "Weixin",
      blurb: "Weixin QR login + getupdates long-poll channel",
    },
    configSchema: {
      schema: WEIXIN_PLUGIN_CONFIG_SCHEMA,
      uiHints: WEIXIN_PLUGIN_CONFIG_UI_HINTS,
    },
    agentPrompt: {
      messageToolHints: ({ accountId }: { cfg: Config; accountId?: string | null }) => [
        "To proactively message a Weixin user, use the message tool with channel='weixin' and to='<user_id@im.wechat>'.",
        accountId
          ? `Current Weixin accountId is '${accountId}'. You usually do not need to set accountId unless you want another account.`
          : "If multiple Weixin accounts are configured, set accountId explicitly when sending a proactive message.",
      ],
    },
    auth: {
      login: async (params: {
        cfg: Config;
        pluginId: string;
        channelId: string;
        pluginConfig?: Record<string, unknown>;
        accountId?: string | null;
        baseUrl?: string | null;
        verbose?: boolean;
      }) =>
        await loginWeixinChannel({
          pluginConfig: params.pluginConfig,
          requestedAccountId: params.accountId,
          baseUrl: params.baseUrl,
          verbose: params.verbose,
        }),
      start: async (params: {
        cfg: Config;
        pluginId: string;
        channelId: string;
        pluginConfig?: Record<string, unknown>;
        accountId?: string | null;
        baseUrl?: string | null;
      }) =>
        await startWeixinLoginSession({
          pluginConfig: params.pluginConfig,
          requestedAccountId: params.accountId,
          baseUrl: params.baseUrl,
        }),
      poll: async (params: {
        cfg: Config;
        pluginId: string;
        channelId: string;
        pluginConfig?: Record<string, unknown>;
        sessionId: string;
      }) =>
        await pollWeixinLoginSession({
          sessionId: params.sessionId,
        }),
    },
    nextclaw: {
      isEnabled: (config: Config) => isWeixinPluginEnabled(config, pluginId),
      createChannel: (context: { config: Config; bus: MessageBus }) =>
        new WeixinChannel(readWeixinPluginConfigFromConfig(context.config, pluginId), context.bus),
    },
  };
}

const plugin = {
  id: WEIXIN_PLUGIN_ID,
  name: "NextClaw Weixin Channel",
  description: "Weixin channel plugin for NextClaw.",
  configSchema: WEIXIN_PLUGIN_CONFIG_SCHEMA,
  register(api: NextclawWeixinPluginApi) {
    const pluginConfig = normalizeWeixinPluginConfig(api.pluginConfig);
    api.registerChannel({
      plugin: {
        ...createWeixinChannelPlugin(api.id || WEIXIN_PLUGIN_ID),
        configSchema: {
          schema: WEIXIN_PLUGIN_CONFIG_SCHEMA,
          uiHints: WEIXIN_PLUGIN_CONFIG_UI_HINTS,
        },
        meta: {
          enabledByDefault: pluginConfig.enabled !== false,
        },
      },
    });
  },
};

export default plugin;
