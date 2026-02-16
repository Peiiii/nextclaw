import type { Config } from "@nextclaw/core";
import { getPackageVersion } from "@nextclaw/core";
import { MemoryGetTool, MemorySearchTool } from "@nextclaw/core";
import type { OpenClawPluginTool, PluginReplyDispatchParams, PluginRuntime } from "./types.js";

export type PluginRuntimeBridge = {
  loadConfig?: () => Record<string, unknown>;
  writeConfigFile?: (next: Record<string, unknown>) => Promise<void>;
  dispatchReplyWithBufferedBlockDispatcher?: (params: PluginReplyDispatchParams) => Promise<void>;
};

let bridge: PluginRuntimeBridge = {};

export function setPluginRuntimeBridge(next: PluginRuntimeBridge | null): void {
  bridge = next ?? {};
}

function toPluginTool(tool: MemorySearchTool | MemoryGetTool): OpenClawPluginTool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: (params: Record<string, unknown>) => tool.execute(params)
  };
}

function loadConfigWithFallback(config?: Config): Record<string, unknown> {
  if (bridge.loadConfig) {
    return bridge.loadConfig();
  }
  return (config as unknown as Record<string, unknown>) ?? {};
}

async function writeConfigWithFallback(next: Record<string, unknown>): Promise<void> {
  if (!bridge.writeConfigFile) {
    throw new Error("plugin runtime config.writeConfigFile is unavailable outside gateway runtime");
  }
  await bridge.writeConfigFile(next);
}

async function dispatchReplyWithFallback(params: PluginReplyDispatchParams): Promise<void> {
  if (!bridge.dispatchReplyWithBufferedBlockDispatcher) {
    throw new Error("plugin runtime channel.reply dispatcher is unavailable outside gateway runtime");
  }
  await bridge.dispatchReplyWithBufferedBlockDispatcher(params);
}

export function createPluginRuntime(params: { workspace: string; config?: Config }): PluginRuntime {
  return {
    version: getPackageVersion(),
    config: {
      loadConfig: () => loadConfigWithFallback(params.config),
      writeConfigFile: async (next: Record<string, unknown>) => writeConfigWithFallback(next)
    },
    tools: {
      createMemorySearchTool: () => toPluginTool(new MemorySearchTool(params.workspace)),
      createMemoryGetTool: () => toPluginTool(new MemoryGetTool(params.workspace))
    },
    channel: {
      reply: {
        dispatchReplyWithBufferedBlockDispatcher: async (dispatchParams: PluginReplyDispatchParams) =>
          dispatchReplyWithFallback(dispatchParams)
      }
    }
  };
}
