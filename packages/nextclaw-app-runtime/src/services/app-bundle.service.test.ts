import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppScaffoldService } from "#app-runtime/services/app-scaffold.service.js";
import { AppBundleService } from "./app-bundle.service.js";
import { strToU8, unzipSync, zipSync } from "fflate";

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

describe("AppBundleService", () => {
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

  it("treats a bundle v1 without distributionMode as a built bundle", async () => {
    const appDirectory = path.join(tmpdir(), `napp-legacy-app-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const bundlePath = path.join(tmpdir(), `napp-legacy-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`);
    const targetDirectory = path.join(tmpdir(), `napp-legacy-target-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    cleanupPaths.push(appDirectory, bundlePath, targetDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const bundleService = new AppBundleService();
    await bundleService.packAppDirectory({ appDirectory, outputPath: bundlePath });

    const archive = unzipSync(new Uint8Array(await readFile(bundlePath)));
    const metadataPath = ".napp/bundle.json";
    const checksumsPath = ".napp/checksums.json";
    const metadata = JSON.parse(Buffer.from(archive[metadataPath] as Uint8Array).toString("utf8")) as Record<string, unknown>;
    delete metadata.distributionMode;
    const metadataBytes = strToU8(`${JSON.stringify(metadata, null, 2)}\n`);
    archive[metadataPath] = metadataBytes;
    const checksums = JSON.parse(Buffer.from(archive[checksumsPath] as Uint8Array).toString("utf8")) as {
      files: Record<string, string>;
    };
    checksums.files[metadataPath] = createHash("sha256").update(metadataBytes).digest("hex");
    archive[checksumsPath] = strToU8(`${JSON.stringify(checksums, null, 2)}\n`);
    await writeFile(bundlePath, Buffer.from(zipSync(archive)));

    const extracted = await bundleService.extractBundle({ bundlePath, targetDirectory });

    expect(extracted.metadata.distributionMode).toBe("bundle");
    await expect(access(path.join(targetDirectory, "manifest.json"))).resolves.toBeUndefined();
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

describe("AppBundleService integrity", () => {

  it("rejects files not covered by checksums before replacing the target", async () => {
    const appDirectory = path.join(tmpdir(), `napp-extra-app-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const bundlePath = path.join(tmpdir(), `napp-extra-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`);
    const targetDirectory = path.join(tmpdir(), `napp-extra-target-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    cleanupPaths.push(appDirectory, bundlePath, targetDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const bundleService = new AppBundleService();
    await bundleService.packAppDirectory({ appDirectory, outputPath: bundlePath });
    const archive = unzipSync(new Uint8Array(await readFile(bundlePath)));
    await writeFile(bundlePath, Buffer.from(zipSync({
      ...archive,
      "unverified.txt": strToU8("not covered"),
    })));
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(path.join(targetDirectory, "sentinel.txt"), "keep");

    await expect(bundleService.extractBundle({ bundlePath, targetDirectory })).rejects.toThrow(
      "精确覆盖",
    );
    await expect(readFile(path.join(targetDirectory, "sentinel.txt"), "utf-8")).resolves.toBe("keep");
  });

  it("keeps the previous target when extracted manifest validation fails", async () => {
    const appDirectory = path.join(tmpdir(), `napp-identity-app-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const bundlePath = path.join(tmpdir(), `napp-identity-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`);
    const targetDirectory = path.join(tmpdir(), `napp-identity-target-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    cleanupPaths.push(appDirectory, bundlePath, targetDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const bundleService = new AppBundleService();
    await bundleService.packAppDirectory({ appDirectory, outputPath: bundlePath });
    const archive = unzipSync(new Uint8Array(await readFile(bundlePath)));
    const metadataPath = ".napp/bundle.json";
    const checksumsPath = ".napp/checksums.json";
    const metadata = JSON.parse(Buffer.from(archive[metadataPath] as Uint8Array).toString("utf8")) as Record<string, unknown>;
    metadata.appId = "nextclaw.tampered-identity";
    const metadataBytes = strToU8(`${JSON.stringify(metadata, null, 2)}\n`);
    archive[metadataPath] = metadataBytes;
    const checksums = JSON.parse(Buffer.from(archive[checksumsPath] as Uint8Array).toString("utf8")) as {
      files: Record<string, string>;
    };
    checksums.files[metadataPath] = createHash("sha256").update(metadataBytes).digest("hex");
    archive[checksumsPath] = strToU8(`${JSON.stringify(checksums, null, 2)}\n`);
    await writeFile(bundlePath, Buffer.from(zipSync(archive)));
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(path.join(targetDirectory, "sentinel.txt"), "keep");

    await expect(bundleService.extractBundle({ bundlePath, targetDirectory })).rejects.toThrow(
      "身份不一致",
    );
    await expect(readFile(path.join(targetDirectory, "sentinel.txt"), "utf-8")).resolves.toBe("keep");
  });

  it("rejects an entry above the uncompressed single-file budget", async () => {
    const bundlePath = path.join(tmpdir(), `napp-large-${Date.now()}-${Math.random().toString(16).slice(2)}.napp`);
    const targetDirectory = path.join(tmpdir(), `napp-large-target-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    cleanupPaths.push(bundlePath, targetDirectory);
    await writeFile(bundlePath, Buffer.from(zipSync({
      "large.bin": new Uint8Array(25 * 1024 * 1024 + 1),
    }, { level: 9 })));

    await expect(new AppBundleService().extractBundle({ bundlePath, targetDirectory })).rejects.toThrow(
      "单文件超过",
    );
  });
});
