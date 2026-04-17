import type { Config, MessageBus } from "@nextclaw/core";
import {
  loginWeixinChannel,
  pollWeixinLoginSession,
  startWeixinLoginSession
} from "./weixin-login.service.js";
import { loadWeixinAccount, listStoredWeixinAccountIds } from "./weixin-account.store.js";
import { WeixinChannel } from "./weixin-channel.js";
import {
  isWeixinPluginEnabled,
  normalizeWeixinPluginConfig,
  resolveConfiguredWeixinAccountIds,
  WEIXIN_CHANNEL_ID,
  WEIXIN_PLUGIN_CONFIG_SCHEMA,
  WEIXIN_PLUGIN_CONFIG_UI_HINTS,
  WEIXIN_PLUGIN_ID,
} from "./weixin-config.js";

type NextclawWeixinPluginApi = {
  id: string;
  config: Config;
  pluginConfig?: Record<string, unknown>;
  registerChannel: (registration: { plugin: Record<string, unknown> }) => void;
};

function readKnownWeixinRoutes(cfg: Config): Array<{ accountId: string; userId: string }> {
  const pluginConfig = normalizeWeixinPluginConfig(cfg.channels?.[WEIXIN_CHANNEL_ID]);
  const knownAccountIds = new Set<string>([
    ...resolveConfiguredWeixinAccountIds(pluginConfig),
    ...listStoredWeixinAccountIds(),
  ]);
  const routes: Array<{ accountId: string; userId: string }> = [];
  const seen = new Set<string>();

  for (const accountId of knownAccountIds) {
    const configuredAllowFrom = pluginConfig.accounts?.[accountId]?.allowFrom ?? [];
    const globalAllowFrom = pluginConfig.allowFrom ?? [];
    const storedUserId = loadWeixinAccount(accountId)?.userId?.trim();
    const candidateUserIds = new Set<string>([...configuredAllowFrom, ...globalAllowFrom]);
    if (storedUserId) {
      candidateUserIds.add(storedUserId);
    }
    for (const userId of candidateUserIds) {
      const normalizedUserId = userId.trim();
      if (!normalizedUserId) {
        continue;
      }
      const key = `${accountId}:${normalizedUserId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      routes.push({ accountId, userId: normalizedUserId });
    }
  }

  return routes;
}

function buildWeixinMessageToolHints(params: { cfg: Config; accountId?: string | null }): string[] {
  const pluginConfig = normalizeWeixinPluginConfig(params.cfg.channels?.[WEIXIN_CHANNEL_ID]);
  const knownRoutes = readKnownWeixinRoutes(params.cfg);
  const hints: string[] = [
    "To proactively message a Weixin user, use the message tool with channel='weixin' and to='<user_id@im.wechat>'.",
  ];

  if (params.accountId) {
    hints.push(
      `Current Weixin accountId is '${params.accountId}'. You usually do not need to set accountId unless you want another account.`,
    );
  } else if (pluginConfig.defaultAccountId) {
    hints.push(`Default Weixin accountId is '${pluginConfig.defaultAccountId}'.`);
  } else if (resolveConfiguredWeixinAccountIds(pluginConfig).length > 1 || listStoredWeixinAccountIds().length > 1) {
    hints.push("If multiple Weixin accounts are configured, set accountId explicitly when sending a proactive message.");
  }

  if (knownRoutes.length === 1) {
    const route = knownRoutes[0];
    hints.push(
      `Known Weixin self-notify route: channel='weixin', accountId='${route.accountId}', to='${route.userId}'. If the user says "notify me on Weixin" and there is no conflicting target, you may use this route directly.`,
    );
  } else if (knownRoutes.length > 1) {
    hints.push(
      `Known Weixin proactive routes: ${knownRoutes.map((route) => `${route.accountId} -> ${route.userId}`).join("; ")}. If the user says "notify me on Weixin", confirm which route to use when the target is ambiguous.`,
    );
  }

  return hints;
}

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
      messageToolHints: ({ cfg, accountId }: { cfg: Config; accountId?: string | null }) =>
        buildWeixinMessageToolHints({ cfg, accountId }),
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
        new WeixinChannel(
          normalizeWeixinPluginConfig(context.config.channels?.[WEIXIN_CHANNEL_ID]),
          context.bus,
        ),
    },
  };
}

const plugin = {
  id: WEIXIN_PLUGIN_ID,
  name: "NextClaw Weixin Channel",
  description: "Weixin channel plugin for NextClaw.",
  configSchema: WEIXIN_PLUGIN_CONFIG_SCHEMA,
  register(api: NextclawWeixinPluginApi) {
    const pluginConfig = normalizeWeixinPluginConfig(
      (api.config as Config).channels?.[WEIXIN_CHANNEL_ID]
    );
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
