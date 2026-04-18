import { describe, expect, it } from "vitest";
import path from "node:path";
import { AppManifestService } from "./app-manifest.service.js";

describe("AppManifestService", () => {
  it("loads the hello-notes example manifest", async () => {
    const service = new AppManifestService();
    const bundle = await service.load(
      path.resolve(process.cwd(), "../../apps/examples/hello-notes"),
    );

    expect(bundle.manifest.id).toBe("nextclaw.hello-notes");
    expect(bundle.manifest.main.action).toBe("summarizeNotes");
    expect(bundle.mainEntryPath.endsWith("main/app.wasm")).toBe(true);
    expect(bundle.uiEntryPath.endsWith("ui/index.html")).toBe(true);
  });
});
