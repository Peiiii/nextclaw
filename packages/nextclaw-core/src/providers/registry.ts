import { PROVIDER_PLUGINS } from "./plugins/index.js";
import type { ProviderCatalogPlugin, ProviderSpec } from "./types.js";

export type { LocalizedText, ProviderCatalogPlugin, ProviderSpec, WireApiMode } from "./types.js";

function mergeProviderSpecs(plugins: ProviderCatalogPlugin[]): ProviderSpec[] {
  const deduped = new Map<string, ProviderSpec>();
  for (const plugin of plugins) {
    for (const provider of plugin.providers) {
      const key = provider.name.trim();
      if (!key) {
        continue;
      }
      deduped.set(key, provider);
    }
  }
  return Array.from(deduped.values());
}

export const PROVIDERS: ProviderSpec[] = mergeProviderSpecs(PROVIDER_PLUGINS);

export function listProviderPlugins(): ProviderCatalogPlugin[] {
  return [...PROVIDER_PLUGINS];
}

export function findProviderByName(name: string): ProviderSpec | undefined {
  return PROVIDERS.find((spec) => spec.name === name);
}

export function findProviderByModel(model: string): ProviderSpec | undefined {
  const modelLower = model.toLowerCase();
  return PROVIDERS.find((spec) => {
    if (spec.isGateway || spec.isLocal) {
      return false;
    }
    return spec.keywords.some((keyword) => modelLower.includes(keyword));
  });
}

export function findGateway(
  providerName?: string | null,
  apiKey?: string | null,
  apiBase?: string | null
): ProviderSpec | undefined {
  if (providerName) {
    const spec = findProviderByName(providerName);
    if (spec && (spec.isGateway || spec.isLocal)) {
      return spec;
    }
  }
  for (const spec of PROVIDERS) {
    if (spec.detectByKeyPrefix && apiKey && apiKey.startsWith(spec.detectByKeyPrefix)) {
      return spec;
    }
    if (spec.detectByBaseKeyword && apiBase && apiBase.includes(spec.detectByBaseKeyword)) {
      return spec;
    }
  }
  return undefined;
}

export function providerLabel(spec: ProviderSpec): string {
  return spec.displayName || spec.name;
}
