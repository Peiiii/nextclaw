import type { ProviderCatalogPlugin, ProviderSpec } from "./types.js";

export type {
  LocalizedText,
  ProviderCatalogPlugin,
  ProviderSpec,
  ProviderDeviceCodeAuthMethodSpec,
  ProviderDeviceCodeAuthProtocol,
  ProviderDeviceCodeAuthSpec,
  WireApiMode
} from "./types.js";

function mergeProviderSpecs(plugins: readonly ProviderCatalogPlugin[]): ProviderSpec[] {
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

export class ProviderRegistry {
  private plugins: ProviderCatalogPlugin[] = [];
  private providers: ProviderSpec[] = [];

  constructor(plugins: ProviderCatalogPlugin[] = []) {
    this.replacePlugins(plugins);
  }

  replacePlugins(plugins: ProviderCatalogPlugin[]): void {
    this.plugins = [...plugins];
    this.providers = mergeProviderSpecs(this.plugins);
  }

  addPlugin(plugin: ProviderCatalogPlugin): void {
    this.plugins.push(plugin);
    this.providers = mergeProviderSpecs(this.plugins);
  }

  listProviderPlugins(): ProviderCatalogPlugin[] {
    return [...this.plugins];
  }

  listProviderSpecs(): ProviderSpec[] {
    return [...this.providers];
  }

  findProviderByName(name: string): ProviderSpec | undefined {
    return this.providers.find((spec) => spec.name === name);
  }

  findProviderByModel(model: string): ProviderSpec | undefined {
    const modelLower = model.toLowerCase();
    return this.providers.find((spec) => {
      if (spec.isGateway || spec.isLocal) {
        return false;
      }
      return spec.keywords.some((keyword) => modelLower.includes(keyword));
    });
  }

  findGateway(providerName?: string | null, apiKey?: string | null, apiBase?: string | null): ProviderSpec | undefined {
    if (providerName) {
      const spec = this.findProviderByName(providerName);
      if (spec && (spec.isGateway || spec.isLocal)) {
        return spec;
      }
    }
    for (const spec of this.providers) {
      if (spec.detectByKeyPrefix && apiKey && apiKey.startsWith(spec.detectByKeyPrefix)) {
        return spec;
      }
      if (spec.detectByBaseKeyword && apiBase && apiBase.includes(spec.detectByBaseKeyword)) {
        return spec;
      }
    }
    return undefined;
  }
}

let globalProviderRegistry = new ProviderRegistry();

export function setProviderRegistry(registry: ProviderRegistry): void {
  globalProviderRegistry = registry;
}

export function configureProviderCatalog(plugins: ProviderCatalogPlugin[]): ProviderRegistry {
  const registry = new ProviderRegistry(plugins);
  setProviderRegistry(registry);
  return registry;
}

export function listProviderPlugins(): ProviderCatalogPlugin[] {
  return globalProviderRegistry.listProviderPlugins();
}

export function listProviderSpecs(): ProviderSpec[] {
  return globalProviderRegistry.listProviderSpecs();
}

export function findProviderByName(name: string): ProviderSpec | undefined {
  return globalProviderRegistry.findProviderByName(name);
}

export function findProviderByModel(model: string): ProviderSpec | undefined {
  return globalProviderRegistry.findProviderByModel(model);
}

export function findGateway(
  providerName?: string | null,
  apiKey?: string | null,
  apiBase?: string | null
): ProviderSpec | undefined {
  return globalProviderRegistry.findGateway(providerName, apiKey, apiBase);
}

export function providerLabel(spec: ProviderSpec): string {
  return spec.displayName || spec.name;
}
