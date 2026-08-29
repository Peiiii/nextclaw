import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppBundleService } from "@nextclaw/app-runtime";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";

const temporaryDirectories: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, "../../../../..");
const fixtureRoot = join(
  repositoryRoot,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components",
);
const runnerPath = join(
  repositoryRoot,
  `packages/nextclaw/resources/native/${process.platform}-${process.arch}`,
  process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner",
);

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-provider-binding-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createKernel(): NextclawKernel {
  const homeDirectory = temporaryDirectory();
  const configPath = join(homeDirectory, "config.json");
  const builtInAppsDirectory = join(homeDirectory, "empty-built-ins");
  mkdirSync(builtInAppsDirectory, { recursive: true });
  saveConfig(ConfigSchema.parse({
    agents: { defaults: { workspace: join(homeDirectory, "workspace") } },
  }), configPath);
  return new NextclawKernel({
    builtInAppsDirectory,
    configPath,
    homeDir: homeDirectory,
    portableServiceRunnerPath: runnerPath,
    productVersion: "0.45.3",
  });
}

async function packServicePackage(params: {
  appId: string;
  sourceComponent: "nextclaw-portable-runtime-lab-provider" | "nextclaw-portable-runtime-lab-composition";
  manifestExtension: Record<string, unknown>;
}): Promise<string> {
  const { appId, manifestExtension, sourceComponent } = params;
  const appDirectory = join(temporaryDirectory(), appId);
  const componentDirectory = join(appDirectory, "service-components", sourceComponent);
  mkdirSync(join(appDirectory, "service-components"), { recursive: true });
  cpSync(join(fixtureRoot, sourceComponent), componentDirectory, { recursive: true });
  const serviceManifestPath = join(componentDirectory, "service-app.json");
  const serviceManifest = JSON.parse(readFileSync(serviceManifestPath, "utf8")) as Record<string, unknown>;
  writeFileSync(serviceManifestPath, `${JSON.stringify({
    ...serviceManifest,
    ...manifestExtension,
  }, null, 2)}\n`);
  writeFileSync(join(appDirectory, "manifest.json"), `${JSON.stringify({
    schemaVersion: 2,
    id: appId,
    name: appId,
    version: "1.0.0",
    engines: { nextclaw: ">=0.45.3" },
    runtime: { profile: "wasi" },
    distribution: { mode: "universal" },
    storage: { scope: "global", schemaVersion: 1 },
    permissions: { storage: { namespace: appId } },
    components: [{ kind: "service", path: `service-components/${sourceComponent}` }],
  }, null, 2)}\n`);
  writeFileSync(join(appDirectory, "marketplace.json"), `${JSON.stringify({
    slug: appId.replaceAll(".", "-"),
    summary: "Provider binding integration fixture.",
    author: "NextClaw",
    tags: ["wasi", "test"],
  }, null, 2)}\n`);
  const artifactPath = join(temporaryDirectory(), `${appId}.napp`);
  await new AppBundleService().packAppDirectory({ appDirectory, outputPath: artifactPath });
  return artifactPath;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { force: true, recursive: true });
  }
});

describe("AppPackageManager Provider bindings", () => {
  it("installs independent Provider and Consumer artifacts and mediates the bound call", async () => {
    const providerArtifact = await packServicePackage({
      appId: "nextclaw.portable-runtime-lab",
      sourceComponent: "nextclaw-portable-runtime-lab-provider",
      manifestExtension: {
        provides: {
          capabilities: [{ id: "contacts.normalize", version: "1", resourceTypes: ["contacts"] }],
        },
      },
    });
    const consumerArtifact = await packServicePackage({
      appId: "nextclaw.portable-runtime",
      sourceComponent: "nextclaw-portable-runtime-lab-composition",
      manifestExtension: {
        requires: {
          capabilities: [{ id: "contacts.normalize", version: "1" }],
          resources: [{ binding: "contacts", type: "contacts" }],
        },
      },
    });
    const kernel = createKernel();
    const caller = { surface: "panel-app", appId: "provider-binding-test" } as const;
    const actionId = "nextclaw-portable-runtime-lab-composition.compose_contact";

    try {
      const consumer = await kernel.appPackageManager.install(consumerArtifact);
      expect(consumer.readiness.status).toBe("needs-capability");
      await expect(kernel.appPackageManager.enable(consumer.id))
        .rejects.toMatchObject({ code: "APP_PACKAGE_NOT_READY" });

      const provider = await kernel.appPackageManager.install(providerArtifact);
      await kernel.appPackageManager.enable(provider.id);
      const ready = await kernel.appPackageManager.setupDependencies(consumer.id);
      expect(ready).toMatchObject({
        readiness: { status: "ready" },
        resolvedProviderIds: {
          "nextclaw-portable-runtime-lab-composition": ["nextclaw-portable-runtime-lab-provider"],
        },
      });
      await kernel.appPackageManager.enable(consumer.id);
      await kernel.serviceAppManager.grantServiceAction(actionId, {
        caller,
        declaredActions: [actionId],
      });
      await expect(kernel.serviceAppManager.invokeServiceAction(actionId, {
        caller,
        declaredActions: [actionId],
        input: {
          name: "  Ada   Lovelace  ",
          email: " ADA@EXAMPLE.COM ",
          tags: ["AI", "ai", "Math"],
        },
      })).resolves.toMatchObject({
        result: {
          displayLabel: "Ada Lovelace <ada@example.com>",
          mediatedBy: "host.component-call",
          provider: { normalizedTags: ["ai", "math"] },
        },
      });

      await expect(kernel.appPackageManager.disable(provider.id))
        .rejects.toMatchObject({ code: "APP_PACKAGE_CONFLICT" });
      await expect(kernel.appPackageManager.unbindDependency(consumer.id, {
        componentId: "nextclaw-portable-runtime-lab-composition",
        requirementKind: "resource",
        requirementId: "contacts",
      })).rejects.toMatchObject({ code: "APP_PACKAGE_CONFLICT" });

      await kernel.appPackageManager.disable(consumer.id);
      const unbound = await kernel.appPackageManager.unbindDependency(consumer.id, {
        componentId: "nextclaw-portable-runtime-lab-composition",
        requirementKind: "resource",
        requirementId: "contacts",
      });
      expect(unbound.readiness.status).toBe("needs-configuration");
      await kernel.appPackageManager.disable(provider.id);
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  }, 30_000);
});
