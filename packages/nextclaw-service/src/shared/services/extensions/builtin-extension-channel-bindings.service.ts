import {
  WEIXIN_CHANNEL_CONFIG_SCHEMA,
  WEIXIN_CHANNEL_CONFIG_UI_HINTS,
  WEIXIN_CHANNEL_ID,
  WEIXIN_EXTENSION_ID,
  WeixinLoginService,
} from "@nextclaw/channel-extension-weixin";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";

class BuiltinExtensionChannelBindingsService {
  private readonly weixinLoginService = new WeixinLoginService();

  private readonly weixinBinding: PluginChannelBinding = {
    pluginId: WEIXIN_EXTENSION_ID,
    channelId: WEIXIN_CHANNEL_ID,
    channel: {
      id: WEIXIN_CHANNEL_ID,
      meta: {
        label: "Weixin",
        selectionLabel: "Weixin",
        blurb: "Weixin QR login + getupdates long-poll channel",
      },
      configSchema: {
        schema: WEIXIN_CHANNEL_CONFIG_SCHEMA as Record<string, unknown>,
        uiHints: WEIXIN_CHANNEL_CONFIG_UI_HINTS,
      },
      auth: {
        login: async ({ accountId, baseUrl, pluginConfig, verbose }) => await this.weixinLoginService.login({
          pluginConfig,
          requestedAccountId: accountId,
          baseUrl,
          verbose,
        }),
        start: async ({ accountId, baseUrl, pluginConfig }) => await this.weixinLoginService.start({
          pluginConfig,
          requestedAccountId: accountId,
          baseUrl,
        }),
        poll: async ({ sessionId }) => await this.weixinLoginService.poll({ sessionId }),
      },
    },
  };

  private readonly weixinUiMetadata: PluginUiMetadata = {
    id: WEIXIN_EXTENSION_ID,
    configSchema: WEIXIN_CHANNEL_CONFIG_SCHEMA as Record<string, unknown>,
    configUiHints: WEIXIN_CHANNEL_CONFIG_UI_HINTS,
  };

  readonly getChannelBindings = (): PluginChannelBinding[] => [this.weixinBinding];

  readonly getUiMetadata = (): PluginUiMetadata[] => [this.weixinUiMetadata];
}

export const builtinExtensionChannelBindings = new BuiltinExtensionChannelBindingsService();
