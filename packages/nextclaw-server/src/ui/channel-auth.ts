import { saveConfig } from "@nextclaw/core";
import {
  enablePluginInConfig,
  type OpenClawChannelAuthPollResult,
  type OpenClawChannelAuthStartResult,
  type PluginChannelBinding
} from "@nextclaw/openclaw-compat";
import { loadConfigOrDefault } from "./config.js";
import type {
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from "./types.js";

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
  if (params.result.status !== "authorized" || !params.result.pluginConfig) {
    return;
  }

  const currentConfig = loadConfigOrDefault(params.configPath);
  const nextConfig = enablePluginInConfig(
    {
      ...currentConfig,
      plugins: {
        ...currentConfig.plugins,
        entries: {
          ...(currentConfig.plugins.entries ?? {}),
          [params.binding.pluginId]: {
            ...(currentConfig.plugins.entries?.[params.binding.pluginId] ?? {}),
            config: params.result.pluginConfig
          }
        }
      }
    },
    params.binding.pluginId
  );
  saveConfig(nextConfig, params.configPath);
}

export async function startChannelAuth(params: {
  configPath: string;
  channelId: string;
  request: ChannelAuthStartRequest;
  bindings: PluginChannelBinding[];
}): Promise<ChannelAuthStartResult | null> {
  const binding = findPluginChannelBinding(params.bindings, params.channelId);
  const start = binding?.channel.auth?.start;
  if (!binding || !start) {
    return null;
  }

  const config = loadConfigOrDefault(params.configPath);
  const result = await start({
    cfg: config,
    pluginId: binding.pluginId,
    channelId: binding.channelId,
    pluginConfig: clonePluginConfig(config.plugins.entries?.[binding.pluginId]?.config),
    accountId: params.request.accountId?.trim() || null,
    baseUrl: params.request.baseUrl?.trim() || null
  });

  return result satisfies OpenClawChannelAuthStartResult;
}

export async function pollChannelAuth(params: {
  configPath: string;
  channelId: string;
  sessionId: string;
  bindings: PluginChannelBinding[];
}): Promise<ChannelAuthPollResult | null> {
  const binding = findPluginChannelBinding(params.bindings, params.channelId);
  const poll = binding?.channel.auth?.poll;
  if (!binding || !poll) {
    return null;
  }

  const config = loadConfigOrDefault(params.configPath);
  const result = await poll({
    cfg: config,
    pluginId: binding.pluginId,
    channelId: binding.channelId,
    pluginConfig: clonePluginConfig(config.plugins.entries?.[binding.pluginId]?.config),
    sessionId: params.sessionId
  });
  if (!result) {
    return null;
  }

  applyAuthorizedChannelAuthResult({
    configPath: params.configPath,
    binding,
    result
  });
  return toPublicChannelAuthPollResult(result);
}
