import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppScaffoldService } from "../scaffold/app-scaffold.service.js";
import { AppBundleService } from "./app-bundle.service.js";

describe("AppBundleService", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupPaths.map((entryPath) =>
        rm(entryPath, {
          recursive: true,
          force: true,
        }),
      ),
    );
    cleanupPaths.length = 0;
  });

  it("packs and extracts a starter app bundle", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-bundle-app-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const bundlePath = path.join(
      tmpdir(),
      `napp-bundle-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    const extractedDirectory = path.join(
      tmpdir(),
      `napp-extracted-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory, bundlePath, extractedDirectory);

    await new AppScaffoldService().scaffold(appDirectory);
    const bundleService = new AppBundleService();
    const packed = await bundleService.packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
    });
    const extracted = await bundleService.extractBundle({
      bundlePath,
      targetDirectory: extractedDirectory,
    });

    await expect(access(bundlePath)).resolves.toBeUndefined();
    await expect(access(path.join(extractedDirectory, ".napp", "checksums.json"))).resolves.toBeUndefined();
    expect(packed.metadata.appId.startsWith("nextclaw.napp-bundle-app-")).toBe(true);
    expect(extracted.metadata.appId).toBe(packed.metadata.appId);
    expect(packed.sizeBytes).toBeGreaterThan(0);
    expect(packed.filePaths).toContain("manifest.json");
    expect(packed.filePaths).toContain("main/app.wasm");
    const bundleJson = JSON.parse(
      await readFile(path.join(extractedDirectory, ".napp", "bundle.json"), "utf-8"),
    ) as { checksumsFile: string };
    expect(bundleJson.checksumsFile).toBe(".napp/checksums.json");
  });

  it("excludes TypeScript build toolchain files from ts-http bundles", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-ts-http-bundle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const bundlePath = path.join(
      tmpdir(),
      `napp-ts-http-bundle-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    const extractedDirectory = path.join(
      tmpdir(),
      `napp-ts-http-extracted-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory, bundlePath, extractedDirectory);

    await new AppScaffoldService().scaffold(appDirectory, { template: "ts-http" });
    await mkdir(path.join(appDirectory, "main", "node_modules", "fake-package"), { recursive: true });
    await writeFile(
      path.join(appDirectory, "main", "node_modules", "fake-package", "index.js"),
      "export const fake = true;\n",
      "utf-8",
    );
    await writeFile(
      path.join(appDirectory, "main", "package-lock.json"),
      "{\"name\":\"fake-lock\"}\n",
      "utf-8",
    );

    const bundleService = new AppBundleService();
    await bundleService.packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
    });
    await bundleService.extractBundle({
      bundlePath,
      targetDirectory: extractedDirectory,
    });

    await expect(access(path.join(extractedDirectory, "main", "app.wasm"))).resolves.toBeUndefined();
    await expect(access(path.join(extractedDirectory, "main", "node_modules"))).rejects.toThrow();
    await expect(access(path.join(extractedDirectory, "main", "package-lock.json"))).rejects.toThrow();
    await expect(access(path.join(extractedDirectory, "main", "src", "component.ts"))).rejects.toThrow();
  });

  it("packs ts-http apps in source mode without bundling runtime toolchain payload", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-ts-http-source-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const bundlePath = path.join(
      tmpdir(),
      `napp-ts-http-source-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`,
    );
    const extractedDirectory = path.join(
      tmpdir(),
      `napp-ts-http-source-extracted-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory, bundlePath, extractedDirectory);

    await new AppScaffoldService().scaffold(appDirectory, { template: "ts-http" });
    await mkdir(path.join(appDirectory, "main", "node_modules", "fake-package"), { recursive: true });
    await mkdir(path.join(appDirectory, "main", "dist"), { recursive: true });
    await mkdir(path.join(appDirectory, "main", "generated"), { recursive: true });
    await writeFile(
      path.join(appDirectory, "main", "node_modules", "fake-package", "index.js"),
      "export const fake = true;\n",
      "utf-8",
    );
    await writeFile(path.join(appDirectory, "main", "dist", "server.js"), "export {};\n", "utf-8");
    await writeFile(
      path.join(appDirectory, "main", "generated", "client.js"),
      "export {};\n",
      "utf-8",
    );
    const originalWasmBytes = await readFile(path.join(appDirectory, "main", "app.wasm"));

    const bundleService = new AppBundleService();
    const packed = await bundleService.packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
      mode: "source",
    });
    const extracted = await bundleService.extractBundle({
      bundlePath,
      targetDirectory: extractedDirectory,
    });

    expect(packed.metadata.distributionMode).toBe("source");
    expect(extracted.metadata.distributionMode).toBe("source");
    expect(packed.filePaths).toContain("main/src/component.ts");
    await expect(access(path.join(extractedDirectory, "main", "src", "component.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(extractedDirectory, "main", "package.json"))).resolves.toBeUndefined();
    await expect(access(path.join(extractedDirectory, "main", "node_modules"))).rejects.toThrow();
    await expect(access(path.join(extractedDirectory, "main", "dist"))).rejects.toThrow();
    await expect(access(path.join(extractedDirectory, "main", "generated"))).rejects.toThrow();
    const extractedWasmBytes = await readFile(path.join(extractedDirectory, "main", "app.wasm"));
    expect(extractedWasmBytes.byteLength).toBeGreaterThan(0);
    expect(extractedWasmBytes.byteLength).toBeLessThanOrEqual(originalWasmBytes.byteLength);
  });
});
