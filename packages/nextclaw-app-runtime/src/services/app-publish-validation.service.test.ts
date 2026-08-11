import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppPublishValidationService } from "./app-publish-validation.service.js";

describe("AppPublishValidationService", () => {
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

  it("validates a wasi-http-component app and reports size warnings", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-validate-publish-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory);
    await mkdir(path.join(appDirectory, "main"), { recursive: true });
    await mkdir(path.join(appDirectory, "ui"), { recursive: true });
    await mkdir(path.join(appDirectory, "assets"), { recursive: true });
    await writeFile(path.join(appDirectory, "assets", "icon.svg"), "<svg />", "utf-8");
    await writeFile(path.join(appDirectory, "ui", "index.html"), "<html></html>", "utf-8");
    await writeFile(path.join(appDirectory, "main", "app.wasm"), Buffer.alloc(11 * 1024 * 1024));
    await writeFile(
      path.join(appDirectory, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "nextclaw.todo",
        name: "Todo",
        version: "0.1.0",
        icon: "assets/icon.svg",
        main: {
          kind: "wasi-http-component",
          entry: "main/app.wasm",
        },
        ui: {
          entry: "ui/index.html",
        },
      }),
      "utf-8",
    );
    await writeFile(
      path.join(appDirectory, "marketplace.json"),
      JSON.stringify({
        slug: "todo",
        summary: "Todo summary",
        summaryI18n: {
          en: "Todo summary",
        },
        author: "NextClaw",
        tags: ["todo"],
      }),
      "utf-8",
    );

    const result = await new AppPublishValidationService().validate({
      appDirectory,
    });

    expect(result.ok).toBe(true);
    expect(result.mainKind).toBe("wasi-http-component");
    expect(result.distributionMode).toBe("source");
    expect(result.bundleFilePaths).toEqual([
      "assets/icon.svg",
      "main/app.wasm",
      "manifest.json",
      "marketplace.json",
      "ui/index.html",
    ]);
    expect(result.warnings.map((warning) => warning.code)).toContain("main-entry-large");
  });
});
