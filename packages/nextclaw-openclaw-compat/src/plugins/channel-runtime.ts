import type { Config } from "@nextclaw/core";
import type {
  OpenClawChannelPlugin,
  PluginChannelRegistration,
  PluginDiagnostic,
  PluginLogger,
  PluginRegistry,
  PluginUiMetadata
} from "./types.js";

export type PluginChannelBinding = {
  pluginId: string;
  channelId: string;
  channel: OpenClawChannelPlugin;
};

export type PluginChannelGatewayHandle = {
  pluginId: string;
  channelId: string;
  accountId: string;
  stop?: () => void | Promise<void>;
};

function normalizeChannelId(channel: string | null | undefined): string {
  return (channel ?? "").trim().toLowerCase();
}

function toBinding(registration: PluginChannelRegistration): PluginChannelBinding | null {
  const channelId = registration.channel.id?.trim();
  if (!channelId) {
    return null;
  }
  return {
    pluginId: registration.pluginId,
    channelId,
    channel: registration.channel
  };
}

export function getPluginChannelBindings(registry: PluginRegistry): PluginChannelBinding[] {
  const bindings: PluginChannelBinding[] = [];
  for (const entry of registry.channels) {
    const binding = toBinding(entry);
    if (!binding) {
      continue;
    }
    bindings.push(binding);
  }
  return bindings;
}

export function resolvePluginChannelMessageToolHints(params: {
  registry: PluginRegistry;
  channel?: string | null;
  cfg?: Config;
  accountId?: string | null;
}): string[] {
  const channelId = normalizeChannelId(params.channel);
  if (!channelId) {
    return [];
  }

  const binding = getPluginChannelBindings(params.registry).find(
    (entry) => normalizeChannelId(entry.channelId) === channelId
  );
  if (!binding) {
    return [];
  }

  const resolveHints = binding.channel.agentPrompt?.messageToolHints;
  if (typeof resolveHints !== "function") {
    return [];
  }

  try {
    const hinted = (
      resolveHints as unknown as (args: { cfg: Config; accountId?: string | null }) => unknown
    )({
      cfg: params.cfg ?? ({} as Config),
      accountId: params.accountId
    });
    if (!Array.isArray(hinted)) {
      return [];
    }
    return hinted
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getPluginUiMetadataFromRegistry(registry: PluginRegistry): PluginUiMetadata[] {
  return registry.plugins.map((plugin) => ({
    id: plugin.id,
    configSchema: plugin.configJsonSchema,
    configUiHints: plugin.configUiHints
  }));
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveProjectedPluginChannelEnabled(params: {
  entryEnabled?: boolean;
  channelConfig?: Record<string, unknown>;
}): boolean {
  const channelEnabled = typeof params.channelConfig?.enabled === "boolean"
    ? params.channelConfig.enabled
    : false;
  return params.entryEnabled !== false && channelEnabled;
}

export function toPluginConfigView(config: Config, bindings: PluginChannelBinding[]): Record<string, unknown> {
  const view = cloneConfig(config) as Record<string, unknown>;
  const channels =
    view.channels && typeof view.channels === "object" && !Array.isArray(view.channels)
      ? ({ ...(view.channels as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  for (const binding of bindings) {
    const pluginEntry = config.plugins.entries?.[binding.pluginId];
    const pluginConfig = pluginEntry?.config;
    const normalizedChannelConfig =
      pluginConfig && typeof pluginConfig === "object" && !Array.isArray(pluginConfig)
        ? cloneConfig(pluginConfig) as Record<string, unknown>
        : {};
    channels[binding.channelId] = {
      ...normalizedChannelConfig,
      enabled: resolveProjectedPluginChannelEnabled({
        entryEnabled: pluginEntry?.enabled,
        channelConfig: normalizedChannelConfig
      })
    };
  }

  view.channels = channels;
  return view;
}

export function mergePluginConfigView(
  baseConfig: Config,
  pluginViewConfig: Record<string, unknown>,
  bindings: PluginChannelBinding[]
): Config {
  const next = cloneConfig(baseConfig) as Config;
  const pluginChannels =
    pluginViewConfig.channels && typeof pluginViewConfig.channels === "object" && !Array.isArray(pluginViewConfig.channels)
      ? (pluginViewConfig.channels as Record<string, unknown>)
      : {};

  const entries = { ...(next.plugins.entries ?? {}) };

  for (const binding of bindings) {
    if (!Object.prototype.hasOwnProperty.call(pluginChannels, binding.channelId)) {
      continue;
    }

    const channelConfig = pluginChannels[binding.channelId];
    if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
      continue;
    }

    const normalizedChannelConfig = cloneConfig(channelConfig) as Record<string, unknown>;
    const projectedEnabled = typeof normalizedChannelConfig.enabled === "boolean"
      ? normalizedChannelConfig.enabled
      : undefined;
    const currentEntry = entries[binding.pluginId] ?? {};

    entries[binding.pluginId] = {
      ...currentEntry,
      ...(projectedEnabled === true ? { enabled: true } : {}),
      config: normalizedChannelConfig
    };
  }

  next.plugins = {
    ...next.plugins,
    entries
  };

  return next;
}

export async function startPluginChannelGateways(params: {
  registry: PluginRegistry;
  config?: Config;
  logger?: PluginLogger;
}): Promise<{ handles: PluginChannelGatewayHandle[]; diagnostics: PluginDiagnostic[] }> {
  const logger = params.logger;
  const diagnostics: PluginDiagnostic[] = [];
  const handles: PluginChannelGatewayHandle[] = [];
  const bindings = getPluginChannelBindings(params.registry);
  const configView = params.config ? toPluginConfigView(params.config, bindings) : undefined;

  for (const binding of bindings) {
    const gateway = binding.channel.gateway;
    if (!gateway?.startAccount) {
      continue;
    }

    const accountIdsRaw =
      binding.channel.config?.listAccountIds?.(configView) ?? [
        binding.channel.config?.defaultAccountId?.(configView) ?? "default",
      ];
    const accountIds = Array.from(
      new Set(accountIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean))
    );
    const finalAccountIds = accountIds.length > 0 ? accountIds : ["default"];

    for (const accountId of finalAccountIds) {
      try {
        const started = await gateway.startAccount({
          accountId,
          log: logger
        });
        handles.push({
          pluginId: binding.pluginId,
          channelId: binding.channelId,
          accountId,
          stop:
            started && typeof started === "object" && "stop" in started && typeof started.stop === "function"
              ? started.stop
              : undefined
        });
      } catch (error) {
        const raw = String(error);
        const lower = raw.toLowerCase();
        const level =
          lower.includes("required") || lower.includes("not configured") || lower.includes("missing") ? "warn" : "error";
        const message = `failed to start channel gateway for ${binding.channelId}/${accountId}: ${raw}`;
        diagnostics.push({
          level,
          pluginId: binding.pluginId,
          message
        });
        if (level === "error") {
          logger?.error(message);
        } else {
          logger?.warn(message);
        }
      }
    }
  }

  return { handles, diagnostics };
}

export async function stopPluginChannelGateways(handles: PluginChannelGatewayHandle[]): Promise<void> {
  for (const handle of handles) {
    if (!handle.stop) {
      continue;
    }
    try {
      await handle.stop();
    } catch {
      // Ignore stop failures during shutdown.
    }
  }
}
