import {
  mergeExtensionConfigView,
  toExtensionConfigView,
  type Config,
  type ConfigUiHints,
  type ExtensionChannelBinding,
  type ExtensionUiMetadata,
} from "@nextclaw/core";
import type { ConfigMetaView } from "@nextclaw-server/shared/types/server-api.types.js";

export type ExtensionConfigProjectionOptions = {
  extensionChannelBindings?: ExtensionChannelBinding[];
  extensionUiMetadata?: ExtensionUiMetadata[];
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

export function normalizeExtensionProjectionOptions(options?: ExtensionConfigProjectionOptions): Required<ExtensionConfigProjectionOptions> {
  return {
    extensionChannelBindings: options?.extensionChannelBindings ?? [],
    extensionUiMetadata: options?.extensionUiMetadata ?? []
  };
}

export function getProjectedConfigView(config: Config, options?: ExtensionConfigProjectionOptions): Record<string, unknown> {
  normalizeExtensionProjectionOptions(options);
  return toExtensionConfigView(config);
}

export function getProjectedChannelMap(
  config: Config,
  options?: ExtensionConfigProjectionOptions
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
  options?: ExtensionConfigProjectionOptions
): Record<string, unknown> | null {
  const channel = getProjectedChannelMap(config, options)[channelName];
  if (!channel || typeof channel !== "object" || Array.isArray(channel)) {
    return null;
  }
  return channel;
}

export function buildExtensionChannelUiHints(options?: ExtensionConfigProjectionOptions): ConfigUiHints {
  const normalized = normalizeExtensionProjectionOptions(options);
  if (normalized.extensionChannelBindings.length === 0) {
    return {};
  }

  const hints: ConfigUiHints = {};
  const metadataById = new Map(normalized.extensionUiMetadata.map((item) => [item.id, item]));

  for (const binding of normalized.extensionChannelBindings) {
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

    const extensionHints = metadataById.get(binding.extensionId)?.configUiHints ?? {};
    for (const [key, hint] of Object.entries(extensionHints)) {
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
  options?: ExtensionConfigProjectionOptions
): ConfigMetaView["channels"] {
  const normalized = normalizeExtensionProjectionOptions(options);
  const projectedChannelMap = getProjectedChannelMap(config, normalized);
  const bindingByChannelId = new Map(normalized.extensionChannelBindings.map((binding) => [binding.channelId, binding]));
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

export function mergeProjectedExtensionChannelConfig(
  config: Config,
  channelName: string,
  mergedChannel: Record<string, unknown>,
  options?: ExtensionConfigProjectionOptions
): Config | null {
  const normalized = normalizeExtensionProjectionOptions(options);
  if (!normalized.extensionChannelBindings.some((binding) => binding.channelId === channelName)) {
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
  return mergeExtensionConfigView(config, nextView);
}
