import type { Config } from "@nextclaw/core";
import { toPluginConfigView, type PluginChannelBinding } from "@nextclaw/openclaw-compat";

export function resolveChannelConfigView(config: Config, bindings: PluginChannelBinding[]): Config {
  return toPluginConfigView(config, bindings) as Config;
}
