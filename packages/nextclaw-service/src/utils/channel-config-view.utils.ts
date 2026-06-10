import { toExtensionConfigView, type Config } from "@nextclaw/core";

export function resolveChannelConfigView(config: Config): Config {
  return toExtensionConfigView(config) as Config;
}
