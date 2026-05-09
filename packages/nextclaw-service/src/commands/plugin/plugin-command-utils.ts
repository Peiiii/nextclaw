import { builtinProviderIds } from "@nextclaw/runtime";
import type { PluginRegistry } from "@nextclaw/openclaw-compat";

export const RESERVED_PROVIDER_IDS = builtinProviderIds();

const RESERVED_TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "exec",
  "web_search",
  "web_fetch",
  "message",
  "spawn",
  "sessions_list",
  "sessions_history",
  "memory_search",
  "memory_get",
  "subagents",
  "gateway",
  "cron",
] as const;

export function buildReservedPluginLoadOptions() {
  return {
    reservedToolNames: [...RESERVED_TOOL_NAMES],
    reservedChannelIds: [] as string[],
    reservedProviderIds: RESERVED_PROVIDER_IDS,
    reservedNcpAgentRuntimeKinds: ["native"],
  };
}

export function appendPluginCapabilityLines(lines: string[], plugin: PluginRegistry["plugins"][number]): void {
  if (plugin.toolNames.length > 0) {
    lines.push(`Tools: ${plugin.toolNames.join(", ")}`);
  }
  if (plugin.channelIds.length > 0) {
    lines.push(`Channels: ${plugin.channelIds.join(", ")}`);
  }
  if (plugin.providerIds.length > 0) {
    lines.push(`Providers: ${plugin.providerIds.join(", ")}`);
  }
  if (plugin.ncpAgentRuntimeKinds.length > 0) {
    lines.push(`NCP runtimes: ${plugin.ncpAgentRuntimeKinds.join(", ")}`);
  }
}
