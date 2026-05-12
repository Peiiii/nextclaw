import type { Config, ConfigUiHints } from "@nextclaw/core";
import { mergePluginConfigView, toPluginConfigView, type PluginChannelBinding, type PluginUiMetadata } from "@nextclaw/openclaw-compat";
import type { ConfigMetaView } from "@/shared/types/server-api.types.js";

export type PluginConfigProjectionOptions = {
  pluginChannelBindings?: PluginChannelBinding[];
  pluginUiMetadata?: PluginUiMetadata[];
};

type ChannelTutorialUrls = NonNullable<ConfigMetaView["channels"][number]["tutorialUrls"]>;
const DOCS_BASE_URL = "https://docs.nextclaw.io";
const CHANNEL_TUTORIAL_URLS: Record<string, ChannelTutorialUrls> = {
  feishu: {
    default: `${DOCS_BASE_URL}/guide/tutorials/feishu`,
    en: `${DOCS_BASE_URL}/en/guide/tutorials/feishu`,
    zh: `${DOCS_BASE_URL}/zh/guide/tutorials/feishu`
  },
  weixin: {
    default: "https://npmx.dev/package/@nextclaw/channel-extension-weixin"
  }
};

export function normalizePluginProjectionOptions(options?: PluginConfigProjectionOptions): Required<PluginConfigProjectionOptions> {
  return {
    pluginChannelBindings: options?.pluginChannelBindings ?? [],
    pluginUiMetadata: options?.pluginUiMetadata ?? []
  };
}

export function getProjectedConfigView(config: Config, options?: PluginConfigProjectionOptions): Record<string, unknown> {
  const normalized = normalizePluginProjectionOptions(options);
  return toPluginConfigView(config, normalized.pluginChannelBindings);
}

export function getProjectedChannelMap(
  config: Config,
  options?: PluginConfigProjectionOptions
): Record<string, Record<string, unknown>> {
  const view = getProjectedConfigView(config, options);
  const channels = view.channels;
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) {
    return {};
  }
  return channels as Record<string, Record<string, unknown>>;
}

export function getProjectedChannelConfig(
  config: Config,
  channelName: string,
  options?: PluginConfigProjectionOptions
): Record<string, unknown> | null {
  const channel = getProjectedChannelMap(config, options)[channelName];
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) {
    return null;
  }
  return channel;
}

export function buildPluginChannelUiHints(options?: PluginConfigProjectionOptions): ConfigUiHints {
  const normalized = normalizePluginProjectionOptions(options);
  if (normalized.pluginChannelBindings.length === 0) {
    return {};
  }

  const hints: ConfigUiHints = {};
  const metadataById = new Map(normalized.pluginUiMetadata.map((item) => [item.id, item]));

  for (const binding of normalized.pluginChannelBindings) {
    const channelScope = `channels.${binding.channelId}`;
    const channelMeta = binding.channel.meta as Record<string, unknown> | undefined;
    const channelLabel = typeof channelMeta?.selectionLabel === "string"
      ? channelMeta.selectionLabel
      : typeof channelMeta?.label === "string"
        ? channelMeta.label
        : binding.channelId;
    const channelHelp = typeof channelMeta?.blurb === "string" ? channelMeta.blurb : undefined;

    hints[channelScope] = {
      ...(channelLabel ? { label: channelLabel } : {}),
      ...(channelHelp ? { help: channelHelp } : {})
    };

    const pluginHints = metadataById.get(binding.pluginId)?.configUiHints ?? {};
    for (const [key, hint] of Object.entries(pluginHints)) {
      hints[`${channelScope}.${key}`] = {
        label: hint.label,
        help: hint.help,
        advanced: hint.advanced,
        sensitive: hint.sensitive,
        placeholder: hint.placeholder
      };
    }
  }

  return hints;
}

export function buildProjectedChannelMeta(
  config: Config,
  options?: PluginConfigProjectionOptions
): ConfigMetaView["channels"] {
  const normalized = normalizePluginProjectionOptions(options);
  const projectedChannelMap = getProjectedChannelMap(config, normalized);
  const bindingByChannelId = new Map(normalized.pluginChannelBindings.map((binding) => [binding.channelId, binding]));
  const channelNames = new Set<string>([
    ...Object.keys(config.channels),
    ...Object.keys(projectedChannelMap),
    ...bindingByChannelId.keys()
  ]);

  return [...channelNames].map((name) => {
    const tutorialUrls = CHANNEL_TUTORIAL_URLS[name];
    const tutorialUrl = tutorialUrls?.default ?? tutorialUrls?.en ?? tutorialUrls?.zh;
    const binding = bindingByChannelId.get(name);
    const channelMeta = binding?.channel.meta as Record<string, unknown> | undefined;
    const displayName = typeof channelMeta?.selectionLabel === "string"
      ? channelMeta.selectionLabel
      : typeof channelMeta?.label === "string"
        ? channelMeta.label
        : name;

    return {
      name,
      displayName,
      enabled: Boolean(projectedChannelMap[name]?.enabled),
      tutorialUrl,
      tutorialUrls
    };
  });
}

export function mergeProjectedPluginChannelConfig(
  config: Config,
  channelName: string,
  mergedChannel: Record<string, unknown>,
  options?: PluginConfigProjectionOptions
): Config | null {
  const normalized = normalizePluginProjectionOptions(options);
  if (!normalized.pluginChannelBindings.some((binding) => binding.channelId === channelName)) {
    return null;
  }

  const currentView = getProjectedConfigView(config, normalized);
  const nextView = {
    ...currentView,
    channels: {
      ...((currentView.channels as Record<string, unknown> | undefined) ?? {}),
      [channelName]: mergedChannel
    }
  };
  return mergePluginConfigView(config, nextView, normalized.pluginChannelBindings);
}
