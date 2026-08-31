import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppStorageContext } from "@nextclaw/app-runtime";
import type { AppPackageView } from "@kernel/types/app-package.types.js";
import { AppPackageDependencyCoordinator } from "./app-package-dependency-coordinator.service.js";
import { AppPackageDependencyService } from "./app-package-dependency.service.js";

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-app-dependency-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createStorage(directory: string): AppStorageContext {
  const instanceDirectory = join(directory, "instance");
  const configDirectory = join(instanceDirectory, "config");
  return {
    appId: "consumer-app",
    instanceId: "default",
    instanceDirectory,
    dataDirectory: join(instanceDirectory, "data"),
    configDirectory,
    cacheDirectory: join(instanceDirectory, "cache"),
    tempDirectory: join(instanceDirectory, "tmp"),
  };
}

function writeConsumerManifest(directory: string): void {
  writeFileSync(join(directory, "service-app.json"), JSON.stringify({
    id: "consumer-service",
    title: "Consumer",
    command: "node",
    requires: {
      capabilities: [{ id: "shared-cache", version: "1" }],
      resources: [{ binding: "cache", type: "redis" }],
    },
    actions: { use_cache: { risk: "read" } },
  }));
}

function writeWitConsumerManifest(
  directory: string,
  wit?: Record<string, string>,
  provider?: string,
): void {
  writeFileSync(join(directory, "service-app.json"), JSON.stringify({
    id: "consumer-service",
    title: "Consumer",
    protocol: "wasi-component",
    component: { entry: "service.wasm" },
    requires: {
      capabilities: [{ id: "shared-cache", version: "1", ...(provider ? { provider } : {}), ...(wit ? { wit } : {}) }],
    },
    actions: { use_cache: { risk: "read" } },
  }));
}

function writeProviderManifest(directory: string): void {
  writeFileSync(join(directory, "service-app.json"), JSON.stringify({
    id: "shared-cache-provider",
    title: "Provider",
    protocol: "wasi-component",
    component: { entry: "service.wasm" },
    lifecycle: { mode: "provider" },
    providers: ["consumer-service"],
    provides: { capabilities: [{ id: "shared-cache", version: "1" }] },
    actions: { provide: { risk: "read" } },
  }));
}

function target(storage: AppStorageContext, componentDirectory: string) {
  return {
    appId: "consumer-app",
    storage,
    components: [{ id: "consumer-service", kind: "service" as const, componentDirectory }],
  };
}

const sharedCacheProvider = {
  providerId: "shared-cache-provider",
  appId: "provider-app",
  componentId: "shared-cache-provider",
  capabilities: [{ id: "shared-cache", version: "1", resourceTypes: ["redis"] }],
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { force: true, recursive: true });
  }
});

describe("AppPackageDependencyService", () => {
  it("atomically binds unique Provider candidates without storing credentials", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    writeFileSync(join(directory, ".keep"), "");
    mkdirSync(componentDirectory, { recursive: true });
    writeConsumerManifest(componentDirectory);
    const service = new AppPackageDependencyService();

    const result = await service.setup({
      target: target(storage, componentDirectory),
      providers: [sharedCacheProvider],
    });

    expect(result).toMatchObject({
      readiness: { status: "ready", requirements: [] },
      bindings: [
        { componentId: "consumer-service", requirementKind: "capability", requirementId: "shared-cache@1", providerId: "shared-cache-provider" },
        { componentId: "consumer-service", requirementKind: "resource", requirementId: "cache", providerId: "shared-cache-provider" },
      ],
      resolvedProviderIds: { "consumer-service": ["shared-cache-provider"] },
    });
    const bindingPath = join(storage.configDirectory, "dependencies.json");
    expect(readFileSync(bindingPath, "utf8")).not.toContain("password");
    expect(statSync(bindingPath).mode & 0o777).toBe(0o600);
  });

  it("keeps ambiguous or unavailable Providers structured and non-ready", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeConsumerManifest(componentDirectory);
    const service = new AppPackageDependencyService();
    const ambiguousProvider = { ...sharedCacheProvider, providerId: "other-cache-provider" };

    const initial = await service.setup({
      target: target(storage, componentDirectory),
      providers: [sharedCacheProvider, ambiguousProvider],
    });
    expect(initial.readiness).toMatchObject({ status: "needs-capability" });
    expect(initial.bindings).toEqual([]);
    expect(initial.candidates.every((entry) => entry.providers.length === 2)).toBe(true);

    const bound = await service.bind({
      target: target(storage, componentDirectory),
      providers: [sharedCacheProvider, ambiguousProvider],
      input: {
        componentId: "consumer-service",
        requirementKind: "capability",
        requirementId: "shared-cache@1",
        providerId: "shared-cache-provider",
      },
    });
    expect(bound.readiness.status).toBe("needs-configuration");

    const verifiedAfterProviderLoss = await service.inspect({
      target: target(storage, componentDirectory),
      providers: [],
    });
    expect(verifiedAfterProviderLoss).toMatchObject({
      readiness: { status: "needs-capability" },
      resolvedProviderIds: {},
    });
    // Source projection deliberately keeps a previously validated binding to
    // avoid the catalog -> source-list recursion; readiness is the live gate.
    await expect(service.resolveStoredProviderIds(target(storage, componentDirectory)))
      .resolves.toEqual({ "consumer-service": ["shared-cache-provider"] });
  });

  it("matches a Provider's exact WIT release against the Consumer range and diagnoses migration gaps", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeWitConsumerManifest(componentDirectory, {
      package: "nextclaw:shared-cache",
      interface: "cache",
      version: "^1.1.0",
    });
    const service = new AppPackageDependencyService();
    const compatible = {
      ...sharedCacheProvider,
      capabilities: [{
        id: "shared-cache",
        version: "1",
        wit: { package: "nextclaw:shared-cache", interface: "cache", version: "1.2.0" },
      }],
    };

    const mixedCatalog = await service.inspect({
      target: target(storage, componentDirectory),
      providers: [compatible, {
        ...compatible,
        providerId: "incompatible-provider",
        capabilities: [{
          id: "shared-cache",
          version: "1",
          wit: { package: "nextclaw:shared-cache", interface: "different", version: "1.2.0" },
        }],
      }],
    });
    expect(mixedCatalog.diagnostics).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "CAPABILITY_WIT_INCOMPATIBLE" }),
    ]));

    await expect(service.setup({
      target: target(storage, componentDirectory), providers: [compatible],
    })).resolves.toMatchObject({
      readiness: { status: "ready" },
      diagnostics: [],
    });

    const missingWit = {
      ...sharedCacheProvider,
      capabilities: [{ id: "shared-cache", version: "1" }],
    };
    const incompatible = await service.inspect({
      target: target(storage, componentDirectory), providers: [missingWit],
    });
    expect(incompatible).toMatchObject({
      readiness: { status: "needs-capability" },
      diagnostics: [expect.objectContaining({ code: "CAPABILITY_WIT_INCOMPATIBLE" })],
      resolvedProviderIds: {},
    });

    writeWitConsumerManifest(componentDirectory);
    const legacy = await service.inspect({
      target: target(storage, componentDirectory), providers: [missingWit],
    });
    expect(legacy).toMatchObject({
      readiness: { status: "ready" },
      diagnostics: [expect.objectContaining({ code: "CAPABILITY_LEGACY_CONTRACT" })],
    });

    writeFileSync(join(componentDirectory, "service-app.json"), JSON.stringify({
      id: "consumer-service",
      title: "Consumer",
      protocol: "wasi-component",
      component: { entry: "service.wasm" },
      providers: ["shared-cache-provider"],
      actions: { use_cache: { risk: "read" } },
    }));
    await expect(service.inspect({
      target: target(storage, componentDirectory),
      providers: [missingWit],
    })).resolves.toMatchObject({
      resolvedProviderIds: { "consumer-service": ["shared-cache-provider"] },
      diagnostics: [expect.objectContaining({ code: "CAPABILITY_LEGACY_CONTRACT" })],
    });
  });

  it("resolves a same-package Provider declaratively without a mutable binding", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeWitConsumerManifest(componentDirectory, {
      package: "nextclaw:shared-cache", interface: "cache", version: "^1.1.0",
    }, "shared-cache-provider");
    const provider = {
      ...sharedCacheProvider,
      capabilities: [{
        id: "shared-cache", version: "1",
        wit: { package: "nextclaw:shared-cache", interface: "cache", version: "1.2.0" },
      }],
    };
    const service = new AppPackageDependencyService();

    await expect(service.inspect({
      target: target(storage, componentDirectory), providers: [provider],
    })).resolves.toMatchObject({
      readiness: { status: "ready" },
      bindings: [],
      resolvedProviderIds: { "consumer-service": ["shared-cache-provider"] },
    });

    await expect(service.inspect({
      target: target(storage, componentDirectory), providers: [{ ...provider, capabilities: [{
        id: "shared-cache", version: "1",
        wit: { package: "nextclaw:shared-cache", interface: "different", version: "1.2.0" },
      }] }],
    })).resolves.toMatchObject({
      readiness: { status: "needs-capability" },
      diagnostics: [expect.objectContaining({ code: "CAPABILITY_WIT_INCOMPATIBLE" })],
    });
  });

});

describe("AppPackageDependencyService installed coordination", () => {
  it("projects packaged Providers through the dependency coordinator before activation", async () => {
    const directory = createTemporaryDirectory();
    const consumerDirectory = join(directory, "consumer-service");
    const providerDirectory = join(directory, "provider-service");
    const storage = createStorage(directory);
    mkdirSync(consumerDirectory, { recursive: true });
    mkdirSync(providerDirectory, { recursive: true });
    writeWitConsumerManifest(consumerDirectory, {
      package: "nextclaw:shared-cache", interface: "cache", version: "^1.1.0",
    }, "shared-cache-provider");
    writeFileSync(join(providerDirectory, "service-app.json"), JSON.stringify({
      id: "shared-cache-provider", title: "Provider", protocol: "wasi-component",
      component: { entry: "service.wasm" }, lifecycle: { mode: "provider" }, actions: { provide: { risk: "read" } },
      provides: { capabilities: [{ id: "shared-cache", version: "1", wit: {
        package: "nextclaw:shared-cache", interface: "cache", version: "1.2.0",
      } }] },
    }));
    const coordinator = new AppPackageDependencyCoordinator({
      installationService: {} as never,
      registryService: { listApps: async () => [] } as never,
      listCapabilityProviders: async () => [],
      resolveSecurity: () => ({ runtimeProfile: "wasi", isolation: "host-mediated", permissions: {} }),
    });

    await expect(coordinator.inspectTarget({
      appId: "consumer-app", storage,
      components: [
        { id: "consumer-service", kind: "service", componentDirectory: consumerDirectory },
        { id: "shared-cache-provider", kind: "service", componentDirectory: providerDirectory },
      ],
    }, [])).resolves.toMatchObject({
      readiness: { status: "ready" },
      resolvedProviderIds: { "consumer-service": ["shared-cache-provider"] },
    });
  });

  it("surfaces a stored Provider cycle as a non-ready structured diagnostic", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeConsumerManifest(componentDirectory);
    const service = new AppPackageDependencyService();
    await service.setup({
      target: target(storage, componentDirectory), providers: [sharedCacheProvider],
    });

    await expect(service.inspect({
      target: target(storage, componentDirectory),
      providers: [sharedCacheProvider],
      cycles: [{
        componentId: "consumer-service",
        providerIds: ["consumer-service", "shared-cache-provider", "consumer-service"],
      }],
    })).resolves.toMatchObject({
      readiness: { status: "needs-capability" },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "PROVIDER_DEPENDENCY_CYCLE" }),
      ]),
    });
  });

  it("protects a Provider App while an enabled Consumer still binds its service", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeConsumerManifest(componentDirectory);
    const dependencyService = new AppPackageDependencyService();
    await dependencyService.setup({
      target: target(storage, componentDirectory),
      providers: [sharedCacheProvider],
    });
    const coordinator = new AppPackageDependencyCoordinator({
      dependencyService,
      installationService: {
        info: async () => ({
          appId: "consumer-app",
          activeVersion: "1.0.0",
          storage,
          installedVersions: [{
            version: "1.0.0",
            components: [{ id: "consumer-service", kind: "service", componentDirectory }],
          }],
        }),
      } as never,
      registryService: {
        listApps: async () => [{ appId: "consumer-app", enabled: true }],
      } as never,
      listCapabilityProviders: async () => [],
      resolveSecurity: () => ({ runtimeProfile: "wasi", isolation: "host-mediated", permissions: {} }),
    });

    await expect(coordinator.assertNoEnabledDependents({
      id: "provider-app",
      components: [{ id: "shared-cache-provider", kind: "service" }],
    } as AppPackageView)).rejects.toMatchObject({
      code: "APP_PACKAGE_CONFLICT",
      message: expect.stringContaining("consumer-app"),
    });
  });

  it("diagnoses a Provider cycle from installed dependency bindings before enable", async () => {
    const directory = createTemporaryDirectory();
    const consumerDirectory = join(directory, "consumer-service");
    const providerDirectory = join(directory, "provider-service");
    const consumerStorage = createStorage(join(directory, "consumer"));
    const providerStorage = createStorage(join(directory, "provider"));
    mkdirSync(consumerDirectory, { recursive: true });
    mkdirSync(providerDirectory, { recursive: true });
    writeConsumerManifest(consumerDirectory);
    writeProviderManifest(providerDirectory);
    const dependencyService = new AppPackageDependencyService();
    await dependencyService.setup({
      target: target(consumerStorage, consumerDirectory),
      providers: [sharedCacheProvider],
    });
    const consumerInfo = {
      appId: "consumer-app",
      activeVersion: "1.0.0",
      storage: consumerStorage,
      installedVersions: [{
        version: "1.0.0",
        components: [{ id: "consumer-service", kind: "service", componentDirectory: consumerDirectory }],
      }],
    };
    const providerInfo = {
      appId: "provider-app",
      activeVersion: "1.0.0",
      storage: providerStorage,
      installedVersions: [{
        version: "1.0.0",
        components: [{ id: "shared-cache-provider", kind: "service", componentDirectory: providerDirectory }],
      }],
    };
    const coordinator = new AppPackageDependencyCoordinator({
      dependencyService,
      installationService: {
        info: async (appId: string) => appId === "provider-app" ? providerInfo : consumerInfo,
      } as never,
      registryService: {
        listApps: async () => [{ appId: "consumer-app" }, { appId: "provider-app" }],
      } as never,
      listCapabilityProviders: async () => [sharedCacheProvider],
      resolveSecurity: () => ({ runtimeProfile: "wasi", isolation: "host-mediated", permissions: {} }),
    });

    await expect(coordinator.inspect("consumer-app")).resolves.toMatchObject({
      readiness: { status: "needs-capability" },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "PROVIDER_DEPENDENCY_CYCLE" }),
      ]),
    });
  });

  it("rejects dependency binding changes while the Consumer App is enabled", async () => {
    const directory = createTemporaryDirectory();
    const componentDirectory = join(directory, "consumer-service");
    const storage = createStorage(directory);
    mkdirSync(componentDirectory, { recursive: true });
    writeConsumerManifest(componentDirectory);
    const coordinator = new AppPackageDependencyCoordinator({
      installationService: {
        info: async () => ({
          appId: "consumer-app",
          activeVersion: "1.0.0",
          enabled: true,
          storage,
          installedVersions: [{
            version: "1.0.0",
            components: [{ id: "consumer-service", kind: "service", componentDirectory }],
          }],
        }),
        withAppOperation: async (_appId: string, operation: () => Promise<unknown>) => await operation(),
      } as never,
      registryService: { listApps: async () => [] } as never,
      listCapabilityProviders: async () => [sharedCacheProvider],
      resolveSecurity: () => ({ runtimeProfile: "wasi", isolation: "host-mediated", permissions: {} }),
    });

    await expect(coordinator.setup("consumer-app")).rejects.toMatchObject({
      code: "APP_PACKAGE_CONFLICT",
      message: expect.stringContaining("must be disabled"),
    });
  });
});
