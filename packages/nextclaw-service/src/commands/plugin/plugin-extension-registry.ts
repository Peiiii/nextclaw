import type { ExtensionRegistry } from "@nextclaw/core";
import type { PluginRegistry, PluginNcpAgentRuntimeRegistration } from "@nextclaw/openclaw-compat";

export type NextclawExtensionRegistry = ExtensionRegistry & {
  ncpAgentRuntimes: PluginNcpAgentRuntimeRegistration[];
};

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
    ncpAgentRuntimes: pluginRegistry.ncpAgentRuntimes.map((runtime) => ({
      pluginId: runtime.pluginId,
      kind: runtime.kind,
      label: runtime.label,
      createRuntime: runtime.createRuntime,
      createRuntimeForEntry: runtime.createRuntimeForEntry,
      describeSessionType: runtime.describeSessionType,
      describeSessionTypeForEntry: runtime.describeSessionTypeForEntry,
      source: runtime.source,
    })),
    diagnostics: pluginRegistry.diagnostics.map((diag) => ({
      level: diag.level,
      message: diag.message,
      extensionId: diag.pluginId,
      source: diag.source,
    })),
  };
}
