import type { ProviderCatalogPlugin } from "@nextclaw/core";
import { builtinProviderPlugin } from "./builtin.provider.js";

export const BUILTIN_PROVIDER_PLUGINS: ProviderCatalogPlugin[] = [
  builtinProviderPlugin,
];
