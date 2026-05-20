import type { ExtensionRegistry } from "@nextclaw/core";
import type { PluginRegistry } from "@nextclaw/openclaw-compat";

export type NextclawExtensionRegistry = ExtensionRegistry;

export function toExtensionRegistry(pluginRegistry: PluginRegistry): NextclawExtensionRegistry {
  return {
    tools: pluginRegistry.tools.map((tool) => ({
      extensionId: tool.pluginId,
      factory: tool.factory,
      names: tool.names,
      optional: tool.optional,
      source: tool.source,
    })),
    channels: pluginRegistry.channels.map((channel) => ({
      extensionId: channel.pluginId,
      channel: channel.channel,
      source: channel.source,
    })),
    diagnostics: pluginRegistry.diagnostics.map((diag) => ({
      level: diag.level,
      message: diag.message,
      extensionId: diag.pluginId,
      source: diag.source,
    })),
  };
}
