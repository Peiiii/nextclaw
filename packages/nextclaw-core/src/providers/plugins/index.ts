import type { ProviderCatalogPlugin } from "../types.js";
import { builtinProviderPlugin } from "./builtin.js";

export const PROVIDER_PLUGINS: ProviderCatalogPlugin[] = [builtinProviderPlugin];
