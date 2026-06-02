import {
  ProviderRegistry,
  type ProviderCatalogPlugin,
  type ProviderSpec,
} from "@nextclaw/core";
import { BUILTIN_PROVIDER_PLUGINS } from "./builtin-provider-plugins.provider.js";

let builtinProviderRegistry: ProviderRegistry | null = null;

function getBuiltinProviderRegistry(): ProviderRegistry {
  builtinProviderRegistry ??= new ProviderRegistry(BUILTIN_PROVIDER_PLUGINS);
  return builtinProviderRegistry;
}

export function listBuiltinProviderPlugins(): ProviderCatalogPlugin[] {
  return getBuiltinProviderRegistry().listProviderPlugins();
}

export function listBuiltinProviders(): ProviderSpec[] {
  return getBuiltinProviderRegistry().listProviderSpecs();
}

export function findBuiltinProviderByName(
  name: string,
): ProviderSpec | undefined {
  return getBuiltinProviderRegistry().findProviderByName(name);
}

export function builtinProviderIds(): string[] {
  return listBuiltinProviders().map((provider) => provider.name);
}
