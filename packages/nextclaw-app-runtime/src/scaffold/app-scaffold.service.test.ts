import { access, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppManifestService } from "../manifest/app-manifest.service.js";
import { AppBuildService } from "../runtime/app-build.service.js";
import { AppScaffoldService } from "./app-scaffold.service.js";

describe("AppScaffoldService", () => {
  const createdDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirectories.map((directoryPath) =>
        rm(directoryPath, {
          recursive: true,
          force: true,
        }),
      ),
    );
    createdDirectories.length = 0;
  });

  it("creates a runnable starter app scaffold", async () => {
    const service = new AppScaffoldService();
    const appDirectory = path.join(
      tmpdir(),
      `napp-starter-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    createdDirectories.push(appDirectory);

    const result = await service.scaffold(appDirectory);
    const manifestService = new AppManifestService();
    const bundle = await manifestService.load(result.appDirectory);

    await expect(access(path.join(result.appDirectory, "main", "app.wat"))).resolves.toBeUndefined();
    await expect(access(path.join(result.appDirectory, "marketplace.json"))).resolves.toBeUndefined();
    await expect(access(path.join(result.appDirectory, "README.md"))).resolves.toBeUndefined();
    expect(bundle.manifest.id.startsWith("nextclaw.napp-starter-")).toBe(true);
    expect(bundle.manifest.main.kind).toBe("wasm");
    if (bundle.manifest.main.kind !== "wasm") {
      throw new Error("Expected starter scaffold to use wasm main.");
    }
    expect(bundle.manifest.main.action).toBe("runStarterDemo");
    expect(bundle.manifest.ui.entry).toBe("ui/index.html");

    const buildResult = await new AppBuildService().build({
      appDirectory,
      install: false,
    });
    expect(buildResult.built).toBe(false);
    expect(buildResult.skippedReason).toContain("main.kind=wasm");
  });

  it("creates a TypeScript WASI HTTP app scaffold", async () => {
    const service = new AppScaffoldService();
    const appDirectory = path.join(
      tmpdir(),
      `napp-ts-http-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    createdDirectories.push(appDirectory);

    const result = await service.scaffold(appDirectory, { template: "ts-http" });
    const manifestService = new AppManifestService();
    const bundle = await manifestService.load(result.appDirectory);

    await expect(access(path.join(result.appDirectory, "main", "package.json"))).resolves.toBeUndefined();
    await expect(access(path.join(result.appDirectory, "main", "src", "component.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(result.appDirectory, "main", "wit", "world.wit"))).resolves.toBeUndefined();
    expect(result.template).toBe("ts-http");
    expect(bundle.manifest.main.kind).toBe("wasi-http-component");
    expect(bundle.manifest.ui.entry).toBe("ui/index.html");
  });

  it("creates a lightweight TypeScript WASI HTTP app scaffold", async () => {
    const service = new AppScaffoldService();
    const appDirectory = path.join(
      tmpdir(),
      `napp-ts-http-lite-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    createdDirectories.push(appDirectory);

    const result = await service.scaffold(appDirectory, { template: "ts-http-lite" });
    const manifestService = new AppManifestService();
    const bundle = await manifestService.load(result.appDirectory);
    const packageJson = JSON.parse(
      await readFile(path.join(result.appDirectory, "main", "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string> };

    expect(result.template).toBe("ts-http-lite");
    expect(bundle.manifest.main.kind).toBe("wasi-http-component");
    expect(packageJson.dependencies?.hono).toBeUndefined();
  });
});
