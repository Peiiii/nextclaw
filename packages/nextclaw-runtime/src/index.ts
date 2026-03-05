import { installBuiltinProviderRegistry } from "./providers/index.js";

export type { ProviderCatalogPlugin, ProviderSpec } from "@nextclaw/core";

export {
  BUILTIN_CHANNEL_PLUGIN_IDS,
  type BuiltinChannelPluginId,
  isBuiltinChannelPluginId
} from "./channels/builtin.js";

export {
  builtinProviderIds,
  findBuiltinProviderByName,
  installBuiltinProviderRegistry,
  listBuiltinProviderPlugins,
  listBuiltinProviders
} from "./providers/index.js";

installBuiltinProviderRegistry();
