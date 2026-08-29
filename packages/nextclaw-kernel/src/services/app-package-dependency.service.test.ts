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
