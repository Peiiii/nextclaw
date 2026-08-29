import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";

const temporaryDirectories: string[] = [];
const builtInAppsDirectory = resolve(import.meta.dirname, "../../../../nextclaw/resources/apps");

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-app-package-readiness-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createKernel(appsDirectory: string): NextclawKernel {
  const homeDirectory = createTemporaryDirectory();
  const configPath = join(homeDirectory, "config.json");
  saveConfig(ConfigSchema.parse({
    agents: { defaults: { workspace: join(homeDirectory, "workspace") } },
  }), configPath);
  return new NextclawKernel({
    builtInAppsDirectory: appsDirectory,
    configPath,
    homeDir: homeDirectory,
    productVersion: "0.32.0",
  });
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { force: true, recursive: true });
  }
});

describe("AppPackageManager external dependency readiness", () => {
  it("keeps an App installable but blocks enable until its declared external dependency is resolved", async () => {
    const appsDirectory = createTemporaryDirectory();
    const packageDirectory = join(appsDirectory, "external-organizer");
    cpSync(join(builtInAppsDirectory, "nextclaw-personal-organizer"), packageDirectory, {
      recursive: true,
    });
    const serviceManifestPath = join(
      packageDirectory,
      "service-components",
      "nextclaw-personal-organizer-data",
      "service-app.json",
    );
    const serviceManifest = JSON.parse(readFileSync(serviceManifestPath, "utf8")) as Record<string, unknown>;
    serviceManifest.requires = {
      capabilities: [{
        id: "redis",
        version: "1",
        title: "Shared cache",
        remediation: { kind: "agent-setup", summary: "Connect the managed cache." },
      }],
      resources: [{
        binding: "cache",
        type: "redis",
        title: "Team cache",
        remediation: { kind: "agent-setup", summary: "Collect the account connection." },
      }],
    };
    writeFileSync(serviceManifestPath, `${JSON.stringify(serviceManifest, null, 2)}\n`);
    const kernel = createKernel(appsDirectory);

    try {
      await kernel.appPackageManager.start();
      await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
        .resolves.toMatchObject({
          readiness: {
            status: "needs-capability",
            requirements: expect.arrayContaining([
              expect.objectContaining({ kind: "capability", id: "redis@1" }),
              expect.objectContaining({ kind: "configuration", id: "cache" }),
            ]),
          },
        });
      await expect(kernel.appPackageManager.enable("nextclaw.personal-organizer"))
        .rejects.toMatchObject({ code: "APP_PACKAGE_NOT_READY" });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

});
