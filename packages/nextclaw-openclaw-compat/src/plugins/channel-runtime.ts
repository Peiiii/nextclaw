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

export async function startPluginChannelGateways(params: {
  registry: PluginRegistry;
  logger?: PluginLogger;
}): Promise<{ handles: PluginChannelGatewayHandle[]; diagnostics: PluginDiagnostic[] }> {
  const logger = params.logger;
  const diagnostics: PluginDiagnostic[] = [];
  const handles: PluginChannelGatewayHandle[] = [];

  for (const binding of getPluginChannelBindings(params.registry)) {
    const gateway = binding.channel.gateway;
    if (!gateway?.startAccount) {
      continue;
    }

    const accountIdsRaw =
      binding.channel.config?.listAccountIds?.() ?? [binding.channel.config?.defaultAccountId?.() ?? "default"];
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
