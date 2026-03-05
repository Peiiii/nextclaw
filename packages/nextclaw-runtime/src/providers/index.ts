import {
  ProviderRegistry,
  setProviderRegistry,
  type ProviderCatalogPlugin,
  type ProviderSpec
} from "@nextclaw/core";
import { BUILTIN_PROVIDER_PLUGINS } from "./plugins/index.js";

const builtinProviderRegistry = new ProviderRegistry(BUILTIN_PROVIDER_PLUGINS);

export function installBuiltinProviderRegistry(): ProviderRegistry {
  setProviderRegistry(builtinProviderRegistry);
  return builtinProviderRegistry;
}

export function listBuiltinProviderPlugins(): ProviderCatalogPlugin[] {
  return builtinProviderRegistry.listProviderPlugins();
}

export function listBuiltinProviders(): ProviderSpec[] {
  return builtinProviderRegistry.listProviderSpecs();
}

export function findBuiltinProviderByName(name: string): ProviderSpec | undefined {
  return builtinProviderRegistry.findProviderByName(name);
}

export function builtinProviderIds(): string[] {
  return listBuiltinProviders().map((provider) => provider.name);
}
