import type { Config } from "@core/features/config/index.js";

export function cloneExtensionConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toExtensionConfigView(config: Config): Record<string, unknown> {
  return cloneExtensionConfig(config) as Record<string, unknown>;
}

export function mergeExtensionConfigView(
  baseConfig: Config,
  extensionViewConfig: Record<string, unknown>,
): Config {
  const next = cloneExtensionConfig(baseConfig) as Config;
  const channels =
    extensionViewConfig.channels && typeof extensionViewConfig.channels === "object" && !Array.isArray(extensionViewConfig.channels)
      ? (extensionViewConfig.channels as Record<string, unknown>)
      : {};
  return {
    ...next,
    channels: {
      ...next.channels,
      ...cloneExtensionConfig(channels),
    } as Config["channels"],
  };
}
