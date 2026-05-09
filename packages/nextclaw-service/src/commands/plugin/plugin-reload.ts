import type { ExtensionChannelRegistration } from "@nextclaw/core";
import type { PluginChannelBinding } from "@nextclaw/openclaw-compat";

type PluginChannelBindingSignature = `${string}:${string}`;

function buildPluginChannelBindingSignature(binding: PluginChannelBinding): PluginChannelBindingSignature {
  return `${binding.pluginId}:${binding.channelId}`;
}

function buildSortedBindingSignatures(bindings: readonly PluginChannelBinding[]): PluginChannelBindingSignature[] {
  return bindings.map(buildPluginChannelBindingSignature).sort();
}

function buildSortedExtensionChannelIds(channels: readonly ExtensionChannelRegistration[]): string[] {
  return channels
    .map((registration) => registration.channel.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .sort();
}

function areSortedStringListsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function readPluginIdFromPluginsEntryPath(path: string): string | null {
  const prefix = "plugins.entries.";
  if (!path.startsWith(prefix)) {
    return null;
  }
  const suffix = path.slice(prefix.length);
  const [pluginId] = suffix.split(".");
  return pluginId?.trim() ? pluginId.trim() : null;
}

function readChannelIdFromChannelPath(path: string): string | null {
  const prefix = "channels.";
  if (!path.startsWith(prefix)) {
    return null;
  }
  const suffix = path.slice(prefix.length);
  const [channelId] = suffix.split(".");
  return channelId?.trim() ? channelId.trim() : null;
}

export function shouldRestartChannelsForPluginReload(params: {
  changedPaths: readonly string[];
  currentPluginChannelBindings: readonly PluginChannelBinding[];
  nextPluginChannelBindings: readonly PluginChannelBinding[];
  currentExtensionChannels: readonly ExtensionChannelRegistration[];
  nextExtensionChannels: readonly ExtensionChannelRegistration[];
}): boolean {
  const currentBindingSignatures = buildSortedBindingSignatures(params.currentPluginChannelBindings);
  const nextBindingSignatures = buildSortedBindingSignatures(params.nextPluginChannelBindings);
  if (!areSortedStringListsEqual(currentBindingSignatures, nextBindingSignatures)) {
    return true;
  }

  const currentExtensionChannelIds = buildSortedExtensionChannelIds(params.currentExtensionChannels);
  const nextExtensionChannelIds = buildSortedExtensionChannelIds(params.nextExtensionChannels);
  if (!areSortedStringListsEqual(currentExtensionChannelIds, nextExtensionChannelIds)) {
    return true;
  }

  const channelPluginIds = new Set<string>();
  for (const binding of params.currentPluginChannelBindings) {
    channelPluginIds.add(binding.pluginId);
  }
  for (const binding of params.nextPluginChannelBindings) {
    channelPluginIds.add(binding.pluginId);
  }

  for (const path of params.changedPaths) {
    const pluginId = readPluginIdFromPluginsEntryPath(path);
    if (pluginId && channelPluginIds.has(pluginId)) {
      return true;
    }

    const channelId = readChannelIdFromChannelPath(path);
    if (!channelId) {
      continue;
    }
    if (
      params.currentPluginChannelBindings.some((binding) => binding.channelId === channelId) ||
      params.nextPluginChannelBindings.some((binding) => binding.channelId === channelId)
    ) {
      return true;
    }
  }

  return false;
}
