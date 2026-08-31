import * as childProcess from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NpmRuntimeLauncher } from "@nextclaw-service/launcher/npm-runtime-launcher.service.js";
import { NpmRuntimeBundleLayoutStore } from "@nextclaw-service/stores/npm-runtime-bundle-layout.store.js";

vi.mock("node:child_process", async (importOriginal) => ({
  ...await importOriginal<typeof childProcess>(),
  spawnSync: vi.fn(() => ({ status: 0 }))
}));

describe("NpmRuntimeLauncher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(childProcess.spawnSync).mockClear();
  });

  it("passes stable launcher metadata to the runtime bundle child", async () => {
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process exit");
    }) as never);
    const launcher = new NpmRuntimeLauncher({
      argv: ["/usr/bin/node", "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js", "serve"],
      env: { NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER: "1" },
      launcherVersion: "0.30.0",
      packagedAppEntrypoint: "/usr/lib/node_modules/nextclaw/dist/cli/app/index.js"
    });

    await expect(launcher.run()).rejects.toThrow("process exit");
    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      process.execPath,
      ["/usr/lib/node_modules/nextclaw/dist/cli/app/index.js", "serve"],
      expect.objectContaining({
        env: expect.objectContaining({
          NEXTCLAW_RUNTIME_BUNDLE_CHILD: "1",
          NEXTCLAW_NPM_LAUNCHER_ENTRYPOINT: "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js",
          NEXTCLAW_NPM_LAUNCHER_VERSION: "0.30.0"
        })
      })
    );
  });

  it("bootstraps a complete bundle before launching an npm runtime without a runner", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-launcher-self-heal-"));
    const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
    const packagedEntrypoint = join(rootDir, "npm", "dist", "cli", "app", "index.js");
    const bundledEntrypoint = join(layout.getVersionDir("0.45.2"), "runtime", "dist", "cli", "app", "index.js");
    try {
      vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process exit");
      }) as never);
      const bootstrapRuntimeBundle = vi.fn(async () => {
        writeBundleFixture(layout, "0.45.2");
        layout.writeCurrentPointer({ version: "0.45.2" });
      });
      const launcher = new NpmRuntimeLauncher({
        argv: ["/usr/bin/node", "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js", "serve"],
        env: {},
        layout,
        launcherVersion: "0.45.2",
        packagedAppEntrypoint: packagedEntrypoint,
        packagedPortableRunnerPath: join(rootDir, "npm", "resources", "native", "linux-x64", "nextclaw-wasmtime-runner"),
        bootstrapRuntimeBundle
      });

      await expect(launcher.run()).rejects.toThrow("process exit");

      expect(bootstrapRuntimeBundle).toHaveBeenCalledOnce();
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        process.execPath,
        [bundledEntrypoint, "serve"],
        expect.any(Object)
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("refreshes an older complete bundle after the npm launcher advances", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-launcher-version-skew-"));
    const layout = new NpmRuntimeBundleLayoutStore(join(rootDir, "runtime-bundles"));
    const packagedEntrypoint = join(rootDir, "npm", "dist", "cli", "app", "index.js");
    const refreshedEntrypoint = join(layout.getVersionDir("0.48.0-beta.0"), "runtime", "dist", "cli", "app", "index.js");
    try {
      writeBundleFixture(layout, "0.47.0");
      layout.writeCurrentPointer({ version: "0.47.0" });
      vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process exit");
      }) as never);
      const bootstrapRuntimeBundle = vi.fn(async () => {
        writeBundleFixture(layout, "0.48.0-beta.0");
        layout.writeCurrentPointer({ version: "0.48.0-beta.0" });
      });
      const launcher = new NpmRuntimeLauncher({
        argv: ["/usr/bin/node", "/usr/lib/node_modules/nextclaw/dist/cli/launcher/index.js", "serve"],
        env: {},
        layout,
        launcherVersion: "0.48.0-beta.0",
        packagedAppEntrypoint: packagedEntrypoint,
        packagedPortableRunnerPath: join(rootDir, "npm", "resources", "native", "linux-x64", "nextclaw-wasmtime-runner"),
        bootstrapRuntimeBundle
      });

      await expect(launcher.run()).rejects.toThrow("process exit");

      expect(bootstrapRuntimeBundle).toHaveBeenCalledOnce();
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        process.execPath,
        [refreshedEntrypoint, "serve"],
        expect.any(Object)
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

function writeBundleFixture(layout: NpmRuntimeBundleLayoutStore, version: string): void {
  const bundleDir = layout.getVersionDir(version);
  const runtimeScriptPath = join(bundleDir, "runtime", "dist", "cli", "app", "index.js");
  const runnerPath = join(
    bundleDir,
    "runtime",
    "resources",
    "native",
    `${process.platform}-${process.arch}`,
    process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner"
  );
  mkdirSync(dirname(runtimeScriptPath), { recursive: true });
  mkdirSync(dirname(runnerPath), { recursive: true });
  writeFileSync(runtimeScriptPath, "console.log('runtime');\n");
  writeFileSync(runnerPath, "runner");
  if (process.platform !== "win32") chmodSync(runnerPath, 0o755);
  writeFileSync(join(bundleDir, "manifest.json"), `${JSON.stringify({
    bundleVersion: version,
    platform: process.platform,
    arch: process.arch,
    uiVersion: version,
    runtimeVersion: version,
    builtInPluginSetVersion: version,
    launcherCompatibility: { minVersion: "0.1.0" },
    entrypoints: { runtimeScript: "runtime/dist/cli/app/index.js" },
    migrationVersion: 1
  }, null, 2)}\n`);
}
