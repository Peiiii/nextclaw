import { saveConfig } from "@nextclaw/core";
import {
  type ExtensionChannelAuthPollResult,
  type ExtensionChannelAuthStartResult,
  type ExtensionChannelBinding
} from "@nextclaw/core";
import { loadConfigOrDefault } from "@nextclaw-server/features/config/index.js";
import { getProjectedConfigView } from "./extension-channel-config-projection.utils.js";
import type {
  ChannelAuthPollResult,
  ChannelAuthStartRequest,
  ChannelAuthStartResult
} from "@nextclaw-server/shared/types/server-api.types.js";

function cloneChannelConfig(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function findExtensionChannelBinding(bindings: ExtensionChannelBinding[], channelId: string): ExtensionChannelBinding | null {
  const normalizedChannelId = channelId.trim().toLowerCase();
  return bindings.find((binding) => binding.channelId.trim().toLowerCase() === normalizedChannelId) ?? null;
}

function toPublicChannelAuthPollResult(result: ExtensionChannelAuthPollResult): ChannelAuthPollResult {
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
  binding: ExtensionChannelBinding;
  result: ExtensionChannelAuthPollResult;
}): void {
  const { configPath, binding, result } = params;
  if (result.status !== "authorized" || !result.channelConfig) {
    return;
  }

  const currentConfig = loadConfigOrDefault(configPath);
  const nextConfig = {
    ...currentConfig,
    channels: {
      ...currentConfig.channels,
      [binding.channelId]: result.channelConfig as typeof currentConfig.channels[keyof typeof currentConfig.channels]
    }
  };
  saveConfig(nextConfig, configPath);
}

export async function startChannelAuth(params: {
  configPath: string;
  channelId: string;
  request: ChannelAuthStartRequest;
  bindings: ExtensionChannelBinding[];
}): Promise<ChannelAuthStartResult | null> {
  const { configPath, channelId, request, bindings } = params;
  const binding = findExtensionChannelBinding(bindings, channelId);
  const start = binding?.channel.auth?.start;
  if (!binding || !start) {
    return null;
  }

  const config = loadConfigOrDefault(configPath);
  const configView = getProjectedConfigView(config, {
    extensionChannelBindings: bindings
  }) as typeof config;
  const result = await start({
    cfg: configView,
    extensionId: binding.extensionId,
    channelId: binding.channelId,
    channelConfig: cloneChannelConfig(configView.channels?.[binding.channelId]),
    accountId: request.accountId?.trim() || null,
    baseUrl: request.baseUrl?.trim() || null,
    domain: request.domain?.trim() || null
  });

  return result satisfies ExtensionChannelAuthStartResult;
}

export async function pollChannelAuth(params: {
  configPath: string;
  channelId: string;
  sessionId: string;
  bindings: ExtensionChannelBinding[];
}): Promise<ChannelAuthPollResult | null> {
  const { configPath, channelId, sessionId, bindings } = params;
  const binding = findExtensionChannelBinding(bindings, channelId);
  const poll = binding?.channel.auth?.poll;
  if (!binding || !poll) {
    return null;
  }

  const config = loadConfigOrDefault(configPath);
  const configView = getProjectedConfigView(config, {
    extensionChannelBindings: bindings
  }) as typeof config;
  const result = await poll({
    cfg: configView,
    extensionId: binding.extensionId,
    channelId: binding.channelId,
    channelConfig: cloneChannelConfig(configView.channels?.[binding.channelId]),
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
