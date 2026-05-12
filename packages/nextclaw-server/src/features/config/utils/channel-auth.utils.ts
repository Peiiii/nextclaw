import { saveConfig } from "@nextclaw/core";
import {
  enablePluginInConfig,
  type OpenClawChannelAuthPollResult,
  type OpenClawChannelAuthStartResult,
  type PluginChannelBinding
} from "@nextclaw/openclaw-compat";
import { loadConfigOrDefault } from "@/features/config/index.js";
import { getProjectedConfigView } from "./plugin-channel-config-projection.utils.js";
import type {
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from "@/shared/types/server-api.types.js";

function clonePluginConfig(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function findPluginChannelBinding(bindings: PluginChannelBinding[], channelId: string): PluginChannelBinding | null {
  const normalizedChannelId = channelId.trim().toLowerCase();
  return bindings.find((binding) => binding.channelId.trim().toLowerCase() === normalizedChannelId) ?? null;
}

function toPublicChannelAuthPollResult(result: OpenClawChannelAuthPollResult): ChannelAuthPollResult {
  return {
    channel: result.channel,
    status: result.status,
    message: result.message,
    nextPollMs: result.nextPollMs,
    accountId: result.accountId,
    notes: result.notes
  };
}

function applyAuthorizedChannelAuthResult(params: {
  configPath: string;
  binding: PluginChannelBinding;
  result: OpenClawChannelAuthPollResult;
}): void {
  const { configPath, binding, result } = params;
  if (result.status !== "authorized" || !result.pluginConfig) {
    return;
  }

  const currentConfig = loadConfigOrDefault(configPath);
  const nextConfig = enablePluginInConfig(
    {
      ...currentConfig,
      channels: {
        ...currentConfig.channels,
        [binding.channelId]: result.pluginConfig as typeof currentConfig.channels[keyof typeof currentConfig.channels]
      }
    },
    binding.pluginId
  );
  saveConfig(nextConfig, configPath);
}

export async function startChannelAuth(params: {
  configPath: string;
  channelId: string;
  request: ChannelAuthStartRequest;
  bindings: PluginChannelBinding[];
}): Promise<ChannelAuthStartResult | null> {
  const { configPath, channelId, request, bindings } = params;
  const binding = findPluginChannelBinding(bindings, channelId);
  const start = binding?.channel.auth?.start;
  if (!binding || !start) {
    return null;
  }

  const config = loadConfigOrDefault(configPath);
  const configView = getProjectedConfigView(config, {
    pluginChannelBindings: bindings
  }) as typeof config;
  const result = await start({
    cfg: configView,
    pluginId: binding.pluginId,
    channelId: binding.channelId,
    pluginConfig: clonePluginConfig(configView.channels?.[binding.channelId]),
    accountId: request.accountId?.trim() || null,
    baseUrl: request.baseUrl?.trim() || null
  });

  return result satisfies OpenClawChannelAuthStartResult;
}

export async function pollChannelAuth(params: {
  configPath: string;
  channelId: string;
  sessionId: string;
  bindings: PluginChannelBinding[];
}): Promise<ChannelAuthPollResult | null> {
  const { configPath, channelId, sessionId, bindings } = params;
  const binding = findPluginChannelBinding(bindings, channelId);
  const poll = binding?.channel.auth?.poll;
  if (!binding || !poll) {
    return null;
  }

  const config = loadConfigOrDefault(configPath);
  const configView = getProjectedConfigView(config, {
    pluginChannelBindings: bindings
  }) as typeof config;
  const result = await poll({
    cfg: configView,
    pluginId: binding.pluginId,
    channelId: binding.channelId,
    pluginConfig: clonePluginConfig(configView.channels?.[binding.channelId]),
    sessionId
  });
  if (!result) {
    return null;
  }

  applyAuthorizedChannelAuthResult({
    configPath,
    binding,
    result
  });
  return toPublicChannelAuthPollResult(result);
}
