import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppManifestService } from "../manifest/app-manifest.service.js";
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
    expect(bundle.manifest.id.startsWith("nextclaw.napp-starter-")).toBe(true);
    expect(bundle.manifest.main.action).toBe("runStarterDemo");
    expect(bundle.manifest.ui.entry).toBe("ui/index.html");
  });
});
