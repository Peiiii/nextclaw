import { loadConfig, saveConfig } from "../config/loader.js";
import { ConfigSchema, type Config, type ProviderConfig } from "../config/schema.js";
import { PROVIDERS } from "../providers/registry.js";
import type {
  ConfigMetaView,
  ConfigView,
  ProviderConfigUpdate,
  ProviderConfigView
} from "./types.js";

const MASK_MIN_LENGTH = 8;

function maskApiKey(value: string): { apiKeySet: boolean; apiKeyMasked?: string } {
  if (!value) {
    return { apiKeySet: false };
  }
  if (value.length < MASK_MIN_LENGTH) {
    return { apiKeySet: true, apiKeyMasked: "****" };
  }
  return {
    apiKeySet: true,
    apiKeyMasked: `${value.slice(0, 2)}****${value.slice(-4)}`
  };
}

function toProviderView(provider: ProviderConfig): ProviderConfigView {
  const masked = maskApiKey(provider.apiKey);
  return {
    apiKeySet: masked.apiKeySet,
    apiKeyMasked: masked.apiKeyMasked,
    apiBase: provider.apiBase ?? null,
    extraHeaders: provider.extraHeaders ?? null
  };
}

export function buildConfigView(config: Config): ConfigView {
  const providers: Record<string, ProviderConfigView> = {};
  for (const [name, provider] of Object.entries(config.providers)) {
    providers[name] = toProviderView(provider as ProviderConfig);
  }
  return {
    agents: config.agents,
    providers,
    channels: config.channels as Record<string, Record<string, unknown>>,
    tools: config.tools,
    gateway: config.gateway,
    ui: config.ui
  };
}

export function buildConfigMeta(config: Config): ConfigMetaView {
  const providers = PROVIDERS.map((spec) => ({
    name: spec.name,
    displayName: spec.displayName,
    keywords: spec.keywords,
    envKey: spec.envKey,
    isGateway: spec.isGateway,
    isLocal: spec.isLocal,
    defaultApiBase: spec.defaultApiBase
  }));
  const channels = Object.keys(config.channels).map((name) => ({
    name,
    displayName: name,
    enabled: Boolean((config.channels as Record<string, { enabled?: boolean }>)[name]?.enabled)
  }));
  return { providers, channels };
}

export function loadConfigOrDefault(configPath: string): Config {
  return loadConfig(configPath);
}

export function updateModel(configPath: string, model: string): ConfigView {
  const config = loadConfigOrDefault(configPath);
  config.agents.defaults.model = model;
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return buildConfigView(next);
}

export function updateProvider(
  configPath: string,
  providerName: string,
  patch: ProviderConfigUpdate
): ProviderConfigView | null {
  const config = loadConfigOrDefault(configPath);
  const provider = (config.providers as Record<string, ProviderConfig>)[providerName];
  if (!provider) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    provider.apiKey = patch.apiKey ?? "";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiBase")) {
    provider.apiBase = patch.apiBase ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "extraHeaders")) {
    provider.extraHeaders = patch.extraHeaders ?? null;
  }
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const updated = (next.providers as Record<string, ProviderConfig>)[providerName];
  return toProviderView(updated);
}

export function updateChannel(
  configPath: string,
  channelName: string,
  patch: Record<string, unknown>
): Record<string, unknown> | null {
  const config = loadConfigOrDefault(configPath);
  const channel = (config.channels as Record<string, Record<string, unknown>>)[channelName];
  if (!channel) {
    return null;
  }
  (config.channels as Record<string, Record<string, unknown>>)[channelName] = { ...channel, ...patch };
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return (next.channels as Record<string, Record<string, unknown>>)[channelName];
}

export function updateUi(
  configPath: string,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const config = loadConfigOrDefault(configPath);
  config.ui = { ...config.ui, ...patch };
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return next.ui as Record<string, unknown>;
}
