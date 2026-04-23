import { describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppManifestService } from "./app-manifest.service.js";

describe("AppManifestService", () => {
  it("loads the hello-notes example manifest", async () => {
    const service = new AppManifestService();
    const bundle = await service.load(
      path.resolve(process.cwd(), "../../apps/examples/hello-notes"),
    );

    expect(bundle.manifest.id).toBe("nextclaw.hello-notes");
    expect(bundle.manifest.main.kind).toBe("wasm");
    if (bundle.manifest.main.kind !== "wasm") {
      throw new Error("Expected hello-notes to use wasm main.");
    }
    expect(bundle.manifest.main.action).toBe("summarizeNotes");
    expect(bundle.mainEntryPath.endsWith("main/app.wasm")).toBe(true);
    expect(bundle.uiEntryPath.endsWith("ui/index.html")).toBe(true);
  });

  it("loads a wasi-http-component manifest", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-wasi-http-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    await mkdir(path.join(appDirectory, "main"), { recursive: true });
    await mkdir(path.join(appDirectory, "ui"), { recursive: true });
    await writeFile(path.join(appDirectory, "main", "app.wasm"), Buffer.from("00", "hex"));
    await writeFile(path.join(appDirectory, "ui", "index.html"), "");
    await writeFile(
      path.join(appDirectory, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        id: "nextclaw.todo",
        name: "Todo",
        version: "0.1.0",
        main: {
          kind: "wasi-http-component",
          entry: "main/app.wasm",
        },
        ui: {
          entry: "ui/index.html",
        },
      }),
    );

    try {
      const service = new AppManifestService();
      const bundle = await service.load(appDirectory);

      expect(bundle.manifest.main.kind).toBe("wasi-http-component");
      expect(service.summarize(bundle).mainKind).toBe("wasi-http-component");
      expect(service.summarize(bundle).action).toBeUndefined();
    } finally {
      await rm(appDirectory, { recursive: true, force: true });
    }
  });
});
